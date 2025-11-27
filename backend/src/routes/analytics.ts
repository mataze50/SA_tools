import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'

const analyticsRouter = Router()

// GET /analytics/overview - Get high-level analytics overview
analyticsRouter.get('/overview', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const isManager = req.user!.role === 'MANAGER' || req.user!.role === 'ADMIN'

    // Base filter - managers see all, consultants see their own
    const userFilter = isManager ? {} : { userId }

    // Get date ranges
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    // Total sheets
    const totalSheets = await prisma.sheet.count({
      where: userFilter
    })

    // Sheets this month
    const sheetsThisMonth = await prisma.sheet.count({
      where: {
        ...userFilter,
        createdAt: { gte: startOfMonth }
      }
    })

    // Sheets last month
    const sheetsLastMonth = await prisma.sheet.count({
      where: {
        ...userFilter,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
      }
    })

    // Status distribution
    const statusDistribution = await prisma.sheet.groupBy({
      by: ['status'],
      where: userFilter,
      _count: { id: true }
    })

    // Average confidence score
    const avgConfidence = await prisma.sheet.aggregate({
      where: userFilter,
      _avg: { confidenceScore: true }
    })

    // Generation sessions this month
    const generationsThisMonth = await prisma.generationSession.count({
      where: {
        ...userFilter,
        createdAt: { gte: startOfMonth }
      }
    })

    // Templates created
    const templatesCreated = await prisma.template.count({
      where: { userId }
    })

    // Calculate growth rate
    const growthRate = sheetsLastMonth > 0
      ? Math.round(((sheetsThisMonth - sheetsLastMonth) / sheetsLastMonth) * 100)
      : sheetsThisMonth > 0 ? 100 : 0

    res.json({
      success: true,
      data: {
        totalSheets,
        sheetsThisMonth,
        sheetsLastMonth,
        growthRate,
        avgConfidenceScore: Math.round(avgConfidence._avg.confidenceScore || 0),
        generationsThisMonth,
        templatesCreated,
        statusDistribution: statusDistribution.map(s => ({
          status: s.status,
          count: s._count.id
        }))
      }
    })
  } catch (error) {
    console.error('Analytics overview error:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// GET /analytics/activity - Get activity over time
analyticsRouter.get('/activity', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const isManager = req.user!.role === 'MANAGER' || req.user!.role === 'ADMIN'
    const userFilter = isManager ? {} : { userId }

    const { period = '30d' } = req.query

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get sheets created over time
    const sheets = await prisma.sheet.findMany({
      where: {
        ...userFilter,
        createdAt: { gte: startDate }
      },
      select: {
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // Group by date
    const activityByDate: Record<string, number> = {}
    sheets.forEach(sheet => {
      const dateKey = sheet.createdAt.toISOString().split('T')[0]
      activityByDate[dateKey] = (activityByDate[dateKey] || 0) + 1
    })

    // Fill in missing dates
    const activity = []
    const current = new Date(startDate)
    while (current <= now) {
      const dateKey = current.toISOString().split('T')[0]
      activity.push({
        date: dateKey,
        count: activityByDate[dateKey] || 0
      })
      current.setDate(current.getDate() + 1)
    }

    res.json({
      success: true,
      data: { activity, period }
    })
  } catch (error) {
    console.error('Analytics activity error:', error)
    res.status(500).json({ error: 'Failed to fetch activity' })
  }
})

// GET /analytics/competencies - Get competency distribution
analyticsRouter.get('/competencies', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const isManager = req.user!.role === 'MANAGER' || req.user!.role === 'ADMIN'
    const userFilter = isManager ? {} : { userId }

    const competencyDistribution = await prisma.sheet.groupBy({
      by: ['competencyId'],
      where: userFilter,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })

    // Get competency details
    const competencyIds = competencyDistribution.map(c => c.competencyId)
    const competencies = await prisma.competency.findMany({
      where: { id: { in: competencyIds } },
      select: { id: true, code: true, title: true, axis: true }
    })

    const competencyMap = new Map(competencies.map(c => [c.id, c]))

    const distribution = competencyDistribution.map(item => ({
      competencyId: item.competencyId,
      code: competencyMap.get(item.competencyId)?.code || 'N/A',
      title: competencyMap.get(item.competencyId)?.title || 'Unknown',
      axis: competencyMap.get(item.competencyId)?.axis || 'Unknown',
      count: item._count.id
    }))

    // Group by axis
    const byAxis: Record<string, number> = {}
    distribution.forEach(item => {
      byAxis[item.axis] = (byAxis[item.axis] || 0) + item.count
    })

    res.json({
      success: true,
      data: {
        topCompetencies: distribution,
        byAxis: Object.entries(byAxis).map(([axis, count]) => ({ axis, count }))
      }
    })
  } catch (error) {
    console.error('Analytics competencies error:', error)
    res.status(500).json({ error: 'Failed to fetch competency analytics' })
  }
})

// GET /analytics/formats - Get format distribution
analyticsRouter.get('/formats', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const isManager = req.user!.role === 'MANAGER' || req.user!.role === 'ADMIN'
    const userFilter = isManager ? {} : { userId }

    const formatDistribution = await prisma.sheet.groupBy({
      by: ['format'],
      where: userFilter,
      _count: { id: true }
    })

    const sectorDistribution = await prisma.sheet.groupBy({
      by: ['sector'],
      where: userFilter,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    })

    const audienceDistribution = await prisma.sheet.groupBy({
      by: ['audienceType'],
      where: userFilter,
      _count: { id: true }
    })

    const durationStats = await prisma.sheet.aggregate({
      where: userFilter,
      _avg: { duration: true },
      _min: { duration: true },
      _max: { duration: true }
    })

    res.json({
      success: true,
      data: {
        formats: formatDistribution.map(f => ({
          format: f.format,
          count: f._count.id
        })),
        sectors: sectorDistribution.map(s => ({
          sector: s.sector,
          count: s._count.id
        })),
        audiences: audienceDistribution.map(a => ({
          audienceType: a.audienceType,
          count: a._count.id
        })),
        duration: {
          avg: Math.round(durationStats._avg.duration || 0),
          min: durationStats._min.duration || 0,
          max: durationStats._max.duration || 0
        }
      }
    })
  } catch (error) {
    console.error('Analytics formats error:', error)
    res.status(500).json({ error: 'Failed to fetch format analytics' })
  }
})

// GET /analytics/quality - Get quality metrics
analyticsRouter.get('/quality', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const isManager = req.user!.role === 'MANAGER' || req.user!.role === 'ADMIN'
    const userFilter = isManager ? {} : { userId }

    // Confidence score distribution
    const sheets = await prisma.sheet.findMany({
      where: userFilter,
      select: { confidenceScore: true, status: true }
    })

    const confidenceBuckets = {
      excellent: 0,   // 90-100
      good: 0,        // 75-89
      average: 0,     // 60-74
      needsWork: 0    // < 60
    }

    sheets.forEach(sheet => {
      const score = sheet.confidenceScore
      if (score >= 90) confidenceBuckets.excellent++
      else if (score >= 75) confidenceBuckets.good++
      else if (score >= 60) confidenceBuckets.average++
      else confidenceBuckets.needsWork++
    })

    // Validation approval rate
    const validatedSheets = await prisma.sheet.count({
      where: {
        ...userFilter,
        status: 'APPROVED'
      }
    })

    const submittedForValidation = await prisma.sheet.count({
      where: {
        ...userFilter,
        status: { in: ['APPROVED', 'REJECTED', 'PENDING_VALIDATION', 'NEEDS_CHANGES'] }
      }
    })

    const approvalRate = submittedForValidation > 0
      ? Math.round((validatedSheets / submittedForValidation) * 100)
      : 0

    // Average scores by format
    const scoresByFormat = await prisma.sheet.groupBy({
      by: ['format'],
      where: userFilter,
      _avg: { confidenceScore: true },
      _count: { id: true }
    })

    res.json({
      success: true,
      data: {
        confidenceDistribution: [
          { label: 'Excellent (90+)', count: confidenceBuckets.excellent, color: '#22c55e' },
          { label: 'Bon (75-89)', count: confidenceBuckets.good, color: '#84cc16' },
          { label: 'Moyen (60-74)', count: confidenceBuckets.average, color: '#eab308' },
          { label: 'A améliorer (<60)', count: confidenceBuckets.needsWork, color: '#ef4444' }
        ],
        approvalRate,
        validatedCount: validatedSheets,
        submittedCount: submittedForValidation,
        scoresByFormat: scoresByFormat.map(s => ({
          format: s.format,
          avgScore: Math.round(s._avg.confidenceScore || 0),
          count: s._count.id
        }))
      }
    })
  } catch (error) {
    console.error('Analytics quality error:', error)
    res.status(500).json({ error: 'Failed to fetch quality analytics' })
  }
})

// GET /analytics/team (Managers only) - Get team performance
analyticsRouter.get('/team', authenticate, requireRole('MANAGER', 'ADMIN'), async (req, res) => {
  try {
    // Get all consultants and their stats
    const consultants = await prisma.user.findMany({
      where: { role: 'CONSULTANT' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        _count: {
          select: { sheets: true }
        }
      }
    })

    // Get detailed stats for each consultant
    const teamStats = await Promise.all(consultants.map(async (consultant) => {
      const stats = await prisma.sheet.aggregate({
        where: { userId: consultant.id },
        _avg: { confidenceScore: true }
      })

      const approved = await prisma.sheet.count({
        where: { userId: consultant.id, status: 'APPROVED' }
      })

      const pending = await prisma.sheet.count({
        where: { userId: consultant.id, status: 'PENDING_VALIDATION' }
      })

      // Get last activity
      const lastSheet = await prisma.sheet.findFirst({
        where: { userId: consultant.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })

      return {
        id: consultant.id,
        name: `${consultant.firstName} ${consultant.lastName}`,
        email: consultant.email,
        totalSheets: consultant._count.sheets,
        avgScore: Math.round(stats._avg.confidenceScore || 0),
        approvedSheets: approved,
        pendingValidation: pending,
        lastActivity: lastSheet?.createdAt || null
      }
    }))

    // Sort by total sheets descending
    teamStats.sort((a, b) => b.totalSheets - a.totalSheets)

    res.json({
      success: true,
      data: { team: teamStats }
    })
  } catch (error) {
    console.error('Analytics team error:', error)
    res.status(500).json({ error: 'Failed to fetch team analytics' })
  }
})

// GET /analytics/ai - Get AI generation metrics
analyticsRouter.get('/ai', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const isManager = req.user!.role === 'MANAGER' || req.user!.role === 'ADMIN'

    // Get date ranges
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Total generation sessions
    const totalSessions = await prisma.generationSession.count()

    // Sessions this month
    const sessionsThisMonth = await prisma.generationSession.count({
      where: { createdAt: { gte: startOfMonth } }
    })

    // Sessions by status
    const sessionsByStatus = await prisma.generationSession.groupBy({
      by: ['status'],
      _count: { id: true }
    })

    const completedSessions = sessionsByStatus.find(s => s.status === 'COMPLETED')?._count.id || 0
    const failedSessions = sessionsByStatus.find(s => s.status === 'FAILED')?._count.id || 0
    const successRate = totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0

    // API call totals from sheets
    const apiCallStats = await prisma.sheet.aggregate({
      _sum: {
        claudeCalls: true,
        perplexityCalls: true,
        totalCost: true
      }
    })

    // Average generation time (from completed sessions)
    const completedSessionsData = await prisma.generationSession.findMany({
      where: { status: 'COMPLETED', totalDuration: { not: null } },
      select: { totalDuration: true }
    })

    const avgGenerationTime = completedSessionsData.length > 0
      ? Math.round(completedSessionsData.reduce((sum, s) => sum + (s.totalDuration || 0), 0) / completedSessionsData.length / 1000)
      : 0

    // Generation activity over last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recentSessions = await prisma.generationSession.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, status: true }
    })

    const generationActivity: Record<string, { total: number; success: number }> = {}
    recentSessions.forEach(session => {
      const dateKey = session.createdAt.toISOString().split('T')[0]
      if (!generationActivity[dateKey]) {
        generationActivity[dateKey] = { total: 0, success: 0 }
      }
      generationActivity[dateKey].total++
      if (session.status === 'COMPLETED') {
        generationActivity[dateKey].success++
      }
    })

    // Most regenerated sections
    const regenerationStats = await prisma.sheet.aggregate({
      _sum: { claudeCalls: true }
    })

    // Cost breakdown
    const monthlyCost = await prisma.sheet.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { totalCost: true }
    })

    const lastMonthCost = await prisma.sheet.aggregate({
      where: {
        createdAt: {
          gte: startOfLastMonth,
          lt: startOfMonth
        }
      },
      _sum: { totalCost: true }
    })

    res.json({
      success: true,
      data: {
        overview: {
          totalGenerations: totalSessions,
          generationsThisMonth: sessionsThisMonth,
          successRate,
          avgGenerationTime, // in seconds
          totalClaudeCalls: apiCallStats._sum.claudeCalls || 0,
          totalPerplexityCalls: apiCallStats._sum.perplexityCalls || 0
        },
        costs: {
          totalCost: Math.round((apiCallStats._sum.totalCost || 0) * 100) / 100,
          costThisMonth: Math.round((monthlyCost._sum.totalCost || 0) * 100) / 100,
          costLastMonth: Math.round((lastMonthCost._sum.totalCost || 0) * 100) / 100,
          estimatedClaudeCost: Math.round((apiCallStats._sum.claudeCalls || 0) * 0.10 * 100) / 100,
          estimatedPerplexityCost: Math.round((apiCallStats._sum.perplexityCalls || 0) * 0.02 * 100) / 100
        },
        statusDistribution: sessionsByStatus.map(s => ({
          status: s.status,
          count: s._count.id
        })),
        generationActivity: Object.entries(generationActivity)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({
            date,
            total: data.total,
            success: data.success,
            successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0
          }))
      }
    })
  } catch (error) {
    console.error('Analytics AI error:', error)
    res.status(500).json({ error: 'Failed to fetch AI analytics' })
  }
})

// GET /analytics/export - Export analytics data as JSON
analyticsRouter.get('/export', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const isManager = req.user!.role === 'MANAGER' || req.user!.role === 'ADMIN'
    const userFilter = isManager ? {} : { userId }

    const sheets = await prisma.sheet.findMany({
      where: userFilter,
      include: {
        competency: { select: { code: true, title: true, axis: true } },
        user: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const exportData = sheets.map(sheet => ({
      title: sheet.title,
      competencyCode: sheet.competency?.code,
      competencyTitle: sheet.competency?.title,
      axis: sheet.competency?.axis,
      sector: sheet.sector,
      audienceType: sheet.audienceType,
      format: sheet.format,
      duration: sheet.duration,
      confidenceScore: sheet.confidenceScore,
      status: sheet.status,
      author: `${sheet.user.firstName} ${sheet.user.lastName}`,
      createdAt: sheet.createdAt,
      updatedAt: sheet.updatedAt
    }))

    res.json({
      success: true,
      data: {
        exportedAt: new Date(),
        totalRecords: exportData.length,
        sheets: exportData
      }
    })
  } catch (error) {
    console.error('Analytics export error:', error)
    res.status(500).json({ error: 'Failed to export analytics' })
  }
})

export default analyticsRouter
