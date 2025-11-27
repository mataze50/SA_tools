/**
 * Admin API Routes
 * Sprint 12 - ATELIER FORGE
 */

import { Router, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireAdmin, requireAdminOrManager } from '../middleware/adminAuth.js';
import bcrypt from 'bcryptjs';

export const adminRouter = Router();

// Apply authentication and admin check to all routes
adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

// ============ DASHBOARD ============

// GET /api/admin/dashboard - Admin dashboard overview
adminRouter.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      totalSheets,
      sheetsThisMonth,
      pendingValidations,
      totalTemplates,
      usersByRole,
      recentActivity
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active users (logged in last 7 days)
      prisma.user.count({
        where: {
          updatedAt: { gte: sevenDaysAgo }
        }
      }),

      // New users this month
      prisma.user.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
      }),

      // Total sheets
      prisma.sheet.count(),

      // Sheets this month
      prisma.sheet.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
      }),

      // Pending validations
      prisma.sheet.count({
        where: { status: 'IN_REVIEW' }
      }),

      // Total templates
      prisma.template.count(),

      // Users by role
      prisma.user.groupBy({
        by: ['role'],
        _count: true
      }),

      // Recent activity (last 10 sheets)
      prisma.sheet.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          user: {
            select: { firstName: true, lastName: true }
          }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          newUsersThisMonth,
          totalSheets,
          sheetsThisMonth,
          pendingValidations,
          totalTemplates
        },
        usersByRole: usersByRole.map(r => ({
          role: r.role,
          count: r._count
        })),
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============ USER MANAGEMENT ============

// GET /api/admin/users - List all users with pagination
adminRouter.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = '20',
      offset = '0'
    } = req.query;

    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role && typeof role === 'string') {
      where.role = role;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          sector: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { sheets: true }
          }
        },
        orderBy: { [sortBy as string]: sortOrder },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        users: users.map(u => ({
          ...u,
          sheetsCount: u._count.sheets
        })),
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + users.length < total
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id - Get user details
adminRouter.get('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        sector: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        sheets: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: { sheets: true, templates: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users - Create new user
adminRouter.post('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role = 'USER', sector } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, firstName, and lastName are required'
      });
    }

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        sector,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        sector: true,
        isActive: true,
        createdAt: true
      }
    });

    // Log action
    await logAdminAction(req.user!.id, 'CREATE_USER', { userId: user.id, email });

    res.status(201).json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id - Update user
adminRouter.patch('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, sector, isActive } = req.body;

    // Prevent self-demotion
    if (id === req.user!.id && role && role !== 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own admin role'
      });
    }

    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (role !== undefined) updateData.role = role;
    if (sector !== undefined) updateData.sector = sector;
    if (isActive !== undefined) updateData.isActive = isActive;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        sector: true,
        isActive: true,
        updatedAt: true
      }
    });

    // Log action
    await logAdminAction(req.user!.id, 'UPDATE_USER', { userId: id, changes: updateData });

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/:id/reset-password - Reset user password
adminRouter.post('/users/:id/reset-password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    // Log action
    await logAdminAction(req.user!.id, 'RESET_PASSWORD', { userId: id });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id - Delete user (soft delete by deactivating)
adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user!.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Soft delete - deactivate user
    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    });

    // Log action
    await logAdminAction(req.user!.id, 'DELETE_USER', { userId: id });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ============ SYSTEM SETTINGS ============

// In-memory settings store (in production, use database)
const systemSettings: Record<string, any> = {
  siteName: 'ATELIER FORGE',
  maxSheetsPerUser: 100,
  maxTemplatesPerUser: 20,
  defaultSheetFormat: 'IN_PERSON',
  enablePublicSharing: true,
  enableScormExport: true,
  aiModelVersion: 'gpt-4',
  maintenanceMode: false,
  maintenanceMessage: '',
  allowRegistration: true,
  requireEmailVerification: false,
  sessionTimeout: 3600,
  maxFileUploadSize: 10485760 // 10MB
};

// GET /api/admin/settings - Get all system settings
adminRouter.get('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: { settings: systemSettings }
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/settings - Update system settings
adminRouter.patch('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates = req.body;

    // Update settings
    Object.keys(updates).forEach(key => {
      if (key in systemSettings) {
        systemSettings[key] = updates[key];
      }
    });

    // Log action
    await logAdminAction(req.user!.id, 'UPDATE_SETTINGS', { changes: updates });

    res.json({
      success: true,
      data: { settings: systemSettings }
    });
  } catch (error) {
    next(error);
  }
});

// ============ AUDIT LOGS ============

// In-memory audit log store
const auditLogs: Array<{
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  details: any;
  ip?: string;
  timestamp: Date;
}> = [];

async function logAdminAction(userId: string, action: string, details: any) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  auditLogs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    userId,
    userEmail: user?.email,
    action,
    details,
    timestamp: new Date()
  });

  // Keep only last 1000 logs
  if (auditLogs.length > 1000) {
    auditLogs.pop();
  }
}

// GET /api/admin/audit-logs - Get audit logs
adminRouter.get('/audit-logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      action,
      userId,
      limit = '50',
      offset = '0'
    } = req.query;

    let filteredLogs = [...auditLogs];

    if (action && typeof action === 'string') {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    if (userId && typeof userId === 'string') {
      filteredLogs = filteredLogs.filter(log => log.userId === userId);
    }

    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============ CONTENT MANAGEMENT ============

// GET /api/admin/sheets - List all sheets (admin view)
adminRouter.get('/sheets', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      status,
      userId,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      limit = '20',
      offset = '0'
    } = req.query;

    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { sector: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (userId && typeof userId === 'string') {
      where.userId = userId;
    }

    const [sheets, total] = await Promise.all([
      prisma.sheet.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true }
          },
          competency: {
            select: { code: true, title: true }
          }
        },
        orderBy: { [sortBy as string]: sortOrder },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.sheet.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        sheets,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + sheets.length < total
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/sheets/:id - Delete sheet (admin)
adminRouter.delete('/sheets/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const sheet = await prisma.sheet.findUnique({
      where: { id },
      select: { title: true, userId: true }
    });

    if (!sheet) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found'
      });
    }

    await prisma.sheet.delete({
      where: { id }
    });

    // Log action
    await logAdminAction(req.user!.id, 'DELETE_SHEET', { sheetId: id, sheetTitle: sheet.title });

    res.json({
      success: true,
      message: 'Sheet deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/templates - List all templates (admin view)
adminRouter.get('/templates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      search,
      isPublic,
      limit = '20',
      offset = '0'
    } = req.query;

    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (isPublic === 'true') {
      where.isPublic = true;
    } else if (isPublic === 'false') {
      where.isPublic = false;
    }

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        include: {
          user: {
            select: { firstName: true, lastName: true }
          },
          _count: {
            select: { usageHistory: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      prisma.template.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        templates: templates.map(t => ({
          ...t,
          usageCount: t._count.usageHistory
        })),
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/templates/:id - Update template (admin can make public/private)
adminRouter.patch('/templates/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isPublic, isFeatured } = req.body;

    const updateData: any = {};
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

    const template = await prisma.template.update({
      where: { id },
      data: updateData
    });

    // Log action
    await logAdminAction(req.user!.id, 'UPDATE_TEMPLATE', { templateId: id, changes: updateData });

    res.json({
      success: true,
      data: { template }
    });
  } catch (error) {
    next(error);
  }
});

// ============ COMPETENCIES MANAGEMENT ============

// POST /api/admin/competencies - Create competency
adminRouter.post('/competencies', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, title, axis, axisName, description, keywords } = req.body;

    if (!code || !title || !axis || !axisName) {
      return res.status(400).json({
        success: false,
        message: 'code, title, axis, and axisName are required'
      });
    }

    const competency = await prisma.competency.create({
      data: {
        code,
        title,
        axis,
        axisName,
        description,
        keywords: keywords || []
      }
    });

    // Log action
    await logAdminAction(req.user!.id, 'CREATE_COMPETENCY', { competencyId: competency.id, code });

    res.status(201).json({
      success: true,
      data: { competency }
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/competencies/:id - Update competency
adminRouter.patch('/competencies/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, description, keywords } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (keywords !== undefined) updateData.keywords = keywords;

    const competency = await prisma.competency.update({
      where: { id },
      data: updateData
    });

    // Log action
    await logAdminAction(req.user!.id, 'UPDATE_COMPETENCY', { competencyId: id, changes: updateData });

    res.json({
      success: true,
      data: { competency }
    });
  } catch (error) {
    next(error);
  }
});

// ============ SYSTEM STATS ============

// GET /api/admin/stats/growth - Growth statistics
adminRouter.get('/stats/growth', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);

    const now = new Date();
    const stats = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [users, sheets] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate
            }
          }
        }),
        prisma.sheet.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextDate
            }
          }
        })
      ]);

      stats.push({
        date: date.toISOString().split('T')[0],
        users,
        sheets
      });
    }

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
});
