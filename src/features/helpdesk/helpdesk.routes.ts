import { Router } from 'express';
import { helpDeskController } from './helpdesk.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Stats & Audit ──────────────────────────────────────────────────────────
router.get('/stats', helpDeskController.getStats);
router.get('/audit', helpDeskController.getAuditLog);

// ─── Judge Utilities ─────────────────────────────────────────────────────────
router.get('/utilities', helpDeskController.getAllUtilities);
router.get('/utilities/:id', helpDeskController.getUtilityById);
router.post('/utilities', requireRole('dept_head', 'super_admin'), helpDeskController.createUtility);
router.put('/utilities/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateUtilityStatus);
router.delete('/utilities/:id', requireRole('super_admin'), helpDeskController.deleteUtility);

// ─── Club Membership ─────────────────────────────────────────────────────────
router.get('/club', helpDeskController.getAllClubMemberships);
router.get('/club/:id', helpDeskController.getClubMembershipById);
router.post('/club', requireRole('dept_head', 'super_admin'), helpDeskController.createClubMembership);
router.put('/club/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateClubMembershipStatus);
router.delete('/club/:id', requireRole('super_admin'), helpDeskController.deleteClubMembership);

// ─── Circuits ────────────────────────────────────────────────────────────────
router.get('/circuits', helpDeskController.getAllCircuits);
router.get('/circuits/:id', helpDeskController.getCircuitById);
router.post('/circuits', requireRole('dept_head', 'super_admin'), helpDeskController.createCircuit);
router.put('/circuits/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateCircuitStatus);
router.put('/circuits/:id/dsa-details', requireRole('dept_head', 'super_admin'), helpDeskController.updateCircuitDSADetails);
router.delete('/circuits/:id', requireRole('super_admin'), helpDeskController.deleteCircuit);

// ─── Special Benches ────────────────────────────────────────────────────────
router.get('/benches', helpDeskController.getAllBenches);
router.get('/benches/:id', helpDeskController.getBenchById);
router.post('/benches', requireRole('dept_head', 'super_admin'), helpDeskController.createBench);
router.put('/benches/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateBenchStatus);
router.delete('/benches/:id', requireRole('super_admin'), helpDeskController.deleteBench);

// ─── Part-Heards ─────────────────────────────────────────────────────────────
router.get('/part-heards', helpDeskController.getAllPartHeards);
router.get('/part-heards/:id', helpDeskController.getPartHeardById);
router.post('/part-heards', requireRole('dept_head', 'super_admin'), helpDeskController.createPartHeard);
router.put('/part-heards/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updatePartHeardStatus);
router.delete('/part-heards/:id', requireRole('super_admin'), helpDeskController.deletePartHeard);

// ─── Judges' Requests ────────────────────────────────────────────────────────
router.get('/requests', helpDeskController.getAllRequests);
router.get('/requests/:id', helpDeskController.getRequestById);
router.post('/requests', requireRole('dept_head', 'super_admin'), helpDeskController.createRequest);
router.put('/requests/:id', requireRole('dept_head', 'super_admin'), helpDeskController.updateRequest);
router.delete('/requests/:id', requireRole('super_admin'), helpDeskController.deleteRequest);

// ─── Visa Support ────────────────────────────────────────────────────────────
router.get('/visa', helpDeskController.getAllVisaRequests);
router.get('/visa/:id', helpDeskController.getVisaRequestById);
router.post('/visa', requireRole('dept_head', 'super_admin'), helpDeskController.createVisaRequest);
router.put('/visa/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateVisaStatus);
router.delete('/visa/:id', requireRole('super_admin'), helpDeskController.deleteVisaRequest);

// ─── Protocol Support ────────────────────────────────────────────────────────
router.get('/protocol', helpDeskController.getAllProtocolEvents);
router.get('/protocol/:id', helpDeskController.getProtocolEventById);
router.post('/protocol', requireRole('dept_head', 'super_admin'), helpDeskController.createProtocolEvent);
router.put('/protocol/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateProtocolStatus);
router.delete('/protocol/:id', requireRole('super_admin'), helpDeskController.deleteProtocolEvent);

// ─── Service Week ──────────────────────────────────────────────────────────
router.get('/service-weeks', helpDeskController.getAllServiceWeeks);
router.get('/service-weeks/:id', helpDeskController.getServiceWeekById);
router.post('/service-weeks', requireRole('dept_head', 'super_admin'), helpDeskController.createServiceWeek);
router.put('/service-weeks/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateServiceWeekStatus);
router.delete('/service-weeks/:id', requireRole('super_admin'), helpDeskController.deleteServiceWeek);

export default router;