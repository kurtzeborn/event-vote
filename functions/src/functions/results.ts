import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { votingOptionsTable, votesTable } from '../storage.js';
import { VotingOptionEntity, VoteEntity, OptionResult, ResultsResponse, RevealStatusResponse } from '../types.js';
import { ensureTables, handleError, getEventEntity, isErrorResponse, parseEventConfig } from '../utils.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function getRankedResults(eventId: string): Promise<{ ranked: OptionResult[]; totalVotes: number; totalVoters: number }> {
  // Fetch all options
  const optionEntities = votingOptionsTable.listEntities<VotingOptionEntity>({
    queryOptions: { filter: `PartitionKey eq '${eventId}'` },
  });
  const optionMap = new Map<string, VotingOptionEntity>();
  for await (const opt of optionEntities) {
    optionMap.set(opt.rowKey.replace('option_', ''), opt);
  }

  // Fetch all votes
  const voteEntities = votesTable.listEntities<VoteEntity>({
    queryOptions: { filter: `PartitionKey eq '${eventId}'` },
  });

  const voteCounts = new Map<string, number>();
  const voterSets = new Map<string, Set<string>>();
  const allVoters = new Set<string>();
  let totalVotes = 0;

  for await (const vote of voteEntities) {
    const optId = vote.optionId;
    voteCounts.set(optId, (voteCounts.get(optId) || 0) + vote.voteCount);
    totalVotes += vote.voteCount;

    if (!voterSets.has(optId)) voterSets.set(optId, new Set());
    voterSets.get(optId)!.add(vote.voterId);
    allVoters.add(vote.voterId);
  }

  // Build ranked list
  const results: OptionResult[] = [];
  for (const [optionId, optEntity] of optionMap) {
    results.push({
      optionId,
      title: optEntity.title,
      description: optEntity.description,
      totalVotes: voteCounts.get(optionId) || 0,
      uniqueVoters: voterSets.get(optionId)?.size || 0,
      rank: 0,
    });
  }

  // Sort: primary by totalVotes desc, tiebreaker by uniqueVoters desc
  results.sort((a, b) => {
    if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
    return b.uniqueVoters - a.uniqueVoters;
  });

  // Assign ranks (handle ties)
  for (let i = 0; i < results.length; i++) {
    if (i === 0) {
      results[i].rank = 1;
    } else if (
      results[i].totalVotes === results[i - 1].totalVotes &&
      results[i].uniqueVoters === results[i - 1].uniqueVoters
    ) {
      results[i].rank = results[i - 1].rank;
    } else {
      results[i].rank = i + 1;
    }
  }

  return { ranked: results, totalVotes, totalVoters: allVoters.size };
}

// GET /api/events/{eventId}/results - Get results (respect reveal state)
async function getResults(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    const result = await getEventEntity(eventId);
    if (isErrorResponse(result)) return result;
    const event = result;

    // Results only available after voting closes
    if (event.status === 'setup' || event.status === 'open') {
      return { status: 400, jsonBody: { error: 'Results are not yet available' } };
    }

    const { ranked, totalVotes, totalVoters } = await getRankedResults(eventId);
    const revealedCount = event.revealedCount ?? 0;

    // For revealing: only show bottom N results (revealed from bottom up)
    let visibleResults: OptionResult[];
    if (event.status === 'revealing') {
      // Reveal from bottom: show lowest ranked first
      visibleResults = ranked
        .slice(ranked.length - revealedCount)
        .map((r) => ({
          optionId: r.optionId,
          title: r.title,
          description: r.description,
          totalVotes: r.totalVotes,
          uniqueVoters: r.uniqueVoters,
          rank: r.rank,
        }));
    } else {
      // Complete - show all
      visibleResults = ranked.map((r) => ({
        optionId: r.optionId,
        title: r.title,
        description: r.description,
        totalVotes: r.totalVotes,
        uniqueVoters: r.uniqueVoters,
        rank: r.rank,
      }));
    }

    const response: ResultsResponse = {
      eventId,
      eventName: event.name,
      status: event.status,
      totalVotes,
      totalVoters,
      revealedCount,
      totalOptions: ranked.length,
      results: visibleResults,
    };

    return { jsonBody: response };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events/{eventId}/results/status - Get reveal status for polling
async function getRevealStatus(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    const result = await getEventEntity(eventId);
    if (isErrorResponse(result)) return result;
    const event = result;

    // Count total options
    const optionEntities = votingOptionsTable.listEntities<VotingOptionEntity>({
      queryOptions: { filter: `PartitionKey eq '${eventId}'` },
    });
    let totalOptions = 0;
    for await (const _ of optionEntities) {
      totalOptions++;
    }

    const response: RevealStatusResponse = {
      status: event.status,
      revealedCount: event.revealedCount ?? 0,
      totalOptions,
    };

    return { jsonBody: response };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events/{eventId}/results/pdf - Generate PDF report
async function generatePdf(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    const result = await getEventEntity(eventId);
    if (isErrorResponse(result)) return result;
    const event = result;

    if (event.status !== 'complete') {
      return { status: 400, jsonBody: { error: 'PDF report is only available after event is complete' } };
    }

    const { ranked, totalVotes, totalVoters } = await getRankedResults(eventId);

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    let y = height - 60;

    // Title
    page.drawText(event.name, {
      x: 50,
      y,
      size: 24,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 30;

    // Subtitle
    page.drawText('Event Voting Results', {
      x: 50,
      y,
      size: 14,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 30;

    // Summary line
    const summaryText = `Total Votes: ${totalVotes}  |  Unique Voters: ${totalVoters}  |  Event Code: ${eventId}`;
    page.drawText(summaryText, {
      x: 50,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 10;

    // Separator
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 25;

    // Medal labels
    const medalLabel: Record<number, string> = { 1: '(gold)', 2: '(silver)', 3: '(bronze)' };

    // Results
    for (const result of ranked) {
      if (y < 80) {
        page = pdfDoc.addPage([612, 792]);
        y = height - 60;
      }

      // Rank and title
      const rankText = `#${result.rank}`;
      page.drawText(rankText, {
        x: 50,
        y,
        size: 16,
        font: boldFont,
        color: result.rank === 1 ? rgb(0.85, 0.65, 0) : result.rank === 2 ? rgb(0.5, 0.5, 0.5) : result.rank === 3 ? rgb(0.72, 0.45, 0.2) : rgb(0.2, 0.2, 0.2),
      });

      const titleX = 90;
      const titleStr = `${result.title}${medalLabel[result.rank] ? '  ' + medalLabel[result.rank] : ''}`;
      page.drawText(titleStr, {
        x: titleX,
        y,
        size: 14,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Vote count
      const voteText = `${result.totalVotes} votes (${result.uniqueVoters} unique voters)`;
      page.drawText(voteText, {
        x: 90,
        y: y - 18,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Bar chart visualization
      const maxVotes = ranked[0]?.totalVotes || 1;
      const barWidth = ((width - 200) * result.totalVotes) / maxVotes;
      const barColor = result.rank === 1 ? rgb(0.85, 0.65, 0) : result.rank === 2 ? rgb(0.7, 0.7, 0.7) : result.rank === 3 ? rgb(0.72, 0.45, 0.2) : rgb(0.4, 0.6, 0.9);
      page.drawRectangle({
        x: 90,
        y: y - 35,
        width: Math.max(barWidth, 2),
        height: 10,
        color: barColor,
      });

      y -= 55;
    }

    // Footer
    const footerY = 40;
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    page.drawText(`Generated on ${dateStr} via evote.k61.dev`, {
      x: 50,
      y: footerY,
      size: 8,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });

    const pdfBytes = await pdfDoc.save();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="event-${eventId}-results.pdf"`,
      },
      body: pdfBytes,
    };
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/events/{eventId}/public - Public event info for voters
async function getPublicEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    await ensureTables();
    const eventId = request.params.eventId;

    const result = await getEventEntity(eventId);
    if (isErrorResponse(result)) return result;
    const event = result;

    // Check expiration (complete events are still viewable)
    if (event.expiresAt && event.status !== 'complete') {
      const expiresAt = new Date(event.expiresAt);
      if (expiresAt < new Date()) {
        return { status: 410, jsonBody: { error: 'This event has expired' } };
      }
    }

    const config = parseEventConfig(event);

    return {
      jsonBody: {
        id: event.rowKey,
        name: event.name,
        status: event.status,
        config: {
          votesPerAttendee: config.votesPerAttendee,
        },
      },
    };
  } catch (error) {
    return handleError(error);
  }
}

// Register routes
app.http('getResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/results',
  handler: getResults,
});

app.http('getRevealStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/results/status',
  handler: getRevealStatus,
});

app.http('generatePdf', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/results/pdf',
  handler: generatePdf,
});

app.http('getPublicEvent', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{eventId}/public',
  handler: getPublicEvent,
});
