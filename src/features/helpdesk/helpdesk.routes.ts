import { Router } from 'express';
import { helpDeskController } from './helpdesk.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Stats & Audit ──────────────────────────────────────────────────────────
router.get('/stats', helpDeskController.getStats);
router.get('/audit', helpDeskController.getAuditLog);

// ─── Reports ─────────────────────────────────────────────────────────────────
router.get('/reports/dsa', helpDeskController.getDSAReport);
router.get('/reports/dsa/export', helpDeskController.exportDSAReport);

// ─── Judge Utilities ─────────────────────────────────────────────────────────
router.get('/utilities', helpDeskController.getAllUtilities);
router.get('/utilities/:id', helpDeskController.getUtilityById);
router.post('/utilities', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createUtility);
router.post('/utilities/:id/items', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.addUtilityItem);
router.put('/utilities/:id/items/:itemId', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateUtilityItem);
router.delete('/utilities/:id/items/:itemId', requireRole('super_admin'), helpDeskController.deleteUtilityItem);
router.delete('/utilities/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteUtility);

// ─── Club Membership ─────────────────────────────────────────────────────────
router.get('/club', helpDeskController.getAllClubMemberships);
router.get('/club/:id', helpDeskController.getClubMembershipById);
router.post('/club', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createClubMembership);
router.put('/club/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateClubMembershipStatus);
router.delete('/club/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteClubMembership);

// ─── Circuits ────────────────────────────────────────────────────────────────
router.get('/circuits', helpDeskController.getAllCircuits);
router.get('/circuits/:id', helpDeskController.getCircuitById);
router.post('/circuits', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createCircuit);
router.put('/circuits/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateCircuitStatus);
router.put('/circuits/:id/dsa-details', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateCircuitDSADetails);
router.delete('/circuits/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteCircuit);

// ─── Special Benches ────────────────────────────────────────────────────────
router.get('/benches', helpDeskController.getAllBenches);
router.get('/benches/:id', helpDeskController.getBenchById);
router.post('/benches', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createBench);
router.put('/benches/:id', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateBench);
router.put('/benches/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateBenchStatus);
router.delete('/benches/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteBench);

// ─── Part-Heards ─────────────────────────────────────────────────────────────
router.get('/part-heards', helpDeskController.getAllPartHeards);
router.get('/part-heards/:id', helpDeskController.getPartHeardById);
router.post('/part-heards', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createPartHeard);
router.put('/part-heards/:id', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updatePartHeard);
router.put('/part-heards/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updatePartHeardStatus);
router.delete('/part-heards/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deletePartHeard);

// ─── Service Weeks ──────────────────────────────────────────────────────────
router.get('/service-weeks', helpDeskController.getAllServiceWeeks);
router.get('/service-weeks/:id', helpDeskController.getServiceWeekById);
router.post('/service-weeks', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createServiceWeek);
router.put('/service-weeks/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateServiceWeekStatus);
router.delete('/service-weeks/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteServiceWeek);

// ─── Medical Expense Claims ──────────────────────────────────────────────────
router.get('/medical-claims', helpDeskController.getAllMedicalClaims);
router.get('/medical-claims/:id', helpDeskController.getMedicalClaimById);
router.post('/medical-claims', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createMedicalClaim);
router.put('/medical-claims/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateMedicalClaimStatus);
router.delete('/medical-claims/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteMedicalClaim);

// ─── General Requests (Unified) ─────────────────────────────────────────────
// Use /general to match controller methods
router.get('/general', helpDeskController.getAllGeneralRequests);
router.get('/general/:id', helpDeskController.getGeneralRequestById);
router.get('/general/judge/:judgeName', helpDeskController.getGeneralRequestsByJudge);
router.get('/general/type/:requestType', helpDeskController.getGeneralRequestsByType);
router.get('/general/remark/:remarkType', helpDeskController.getGeneralRequestsByRemarkType);
router.get('/general/stats', helpDeskController.getGeneralRequestStats);
router.post('/general', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createGeneralRequest);
router.put('/general/:id', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateGeneralRequest);
router.patch('/general/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateGeneralRequestStatus);
router.delete('/general/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteGeneralRequest);
router.post('/general/:id/email', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.sendGeneralRequestEmail);

// ─── Legacy Security Requests (Deprecated) ──────────────────────────────────
// Keep for backward compatibility
router.get('/security', helpDeskController.getAllSecurityRequests);
router.get('/security/:id', helpDeskController.getSecurityRequestById);
router.get('/security/judge/:judgeName', helpDeskController.getSecurityRequestsByJudge);
router.get('/security/type/:requestType', helpDeskController.getSecurityRequestsByType);
router.get('/security/stats', helpDeskController.getSecurityRequestStats);
router.post('/security', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createSecurityRequest);
router.put('/security/:id', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateSecurityRequest);
router.patch('/security/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateSecurityRequestStatus);
router.delete('/security/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteSecurityRequest);

// ─── Visa Support ────────────────────────────────────────────────────────────
router.get('/visa', helpDeskController.getAllVisaRequests);
router.get('/visa/:id', helpDeskController.getVisaRequestById);
router.post('/visa', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createVisaRequest);
router.put('/visa/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateVisaStatus);
router.delete('/visa/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteVisaRequest);

// ─── Visa Document Tracking ─────────────────────────────────────────────────
router.post('/visa/documents/:id/view', helpDeskController.markDocumentViewed);
router.get('/visa/documents/:id/status', helpDeskController.getDocumentViewStatus);

// ─── Protocol Support ────────────────────────────────────────────────────────
router.get('/protocol', helpDeskController.getAllProtocolEvents);
router.get('/protocol/:id', helpDeskController.getProtocolEventById);
router.post('/protocol', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createProtocolEvent);
router.put('/protocol/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateProtocolStatus);
router.delete('/protocol/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteProtocolEvent);

// ─── Other Payments ──────────────────────────────────────────────────────────
router.get('/other-payments', helpDeskController.getAllOtherPayments);
router.get('/other-payments/:id', helpDeskController.getOtherPaymentById);
router.post('/other-payments', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.createOtherPayment);
router.put('/other-payments/:id/status', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateOtherPaymentStatus);
router.put('/other-payments/:id/dsa-details', requireRole('dept_head', 'super_admin', 'staff'), helpDeskController.updateOtherPaymentDSADetails);
router.delete('/other-payments/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteOtherPayment);

export default router;