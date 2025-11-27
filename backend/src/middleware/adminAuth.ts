/**
 * Admin Authentication Middleware
 * Sprint 12 - ATELIER FORGE
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

/**
 * Middleware to require admin role
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
}

/**
 * Middleware to require admin or manager role
 */
export function requireAdminOrManager(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    return res.status(403).json({
      success: false,
      message: 'Admin or Manager access required'
    });
  }

  next();
}
