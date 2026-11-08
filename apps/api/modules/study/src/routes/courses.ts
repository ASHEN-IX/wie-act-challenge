import { sendCourseInvitationEmail } from '../../../auth/src/services/emailService';
import {
  prepareRevisionSources,
  SourceIntegrityError,
  captureImmutableSources,
  verifyRevisionArtifact,
  verifyBlob,
  manifestDigest,
  type SourceDocument,
} from '../services/revisionSources';
import aiClient from '../../../../shared/aiClient';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction, RequestHandler } from 'express';
import type { FilterQuery } from 'mongoose';
import type { ICourse, ICourseTopic, ISubtopic } from '../models';
import { errorDetails } from '@ednova/shared/errors';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { reviewContext, ensureSnapshot, validateCorrection, fail } from '../services/formulaReview';
import { parseCanonicalDocument } from '../../../../shared/ednova/canonicalDocument';
import { FormulaRecognitionJob } from '../models/FormulaRecognitionJob';
import * as formulaJobs from '../services/formulaJobs';
import { activityDigest } from '../services/activityIdentity';
import { FormulaProposal } from '../models/FormulaProposal';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@ednova/shared/moduleClient');
import {
  Course,
  Subject,
  Institution,
  InstitutionMembership,
  CourseRevision,
  CourseEnrollment
} from '../models';
import { canReadCourse, canManageCourse, canAuthorCourse } from '../services/resourceAccess';
import {
  getCourseDraft,
  withExtractionReview,
  findEditableDraft,
  updateCourseDraft,
  DraftForbiddenError,
  DraftNotFoundError,
  StaleRevisionError,
  HierarchyValidationError
} from '../services/courseDraft';
import { reviewCourseDraft } from '../services/courseReview';
import {
  publishCourseRevision,
  getPublishedCourseContext,
  resolveCourseSource,
  PublicationForbiddenError,
  PublicationNotFoundError,
  UnpublishedCourseError,
  PublicationConflictError,
  PublicationReviewRequiredError,
  PublicationValidationError
} from '../services/coursePublication';
import {
  askGroundedTutor,
  TutorValidationError,
  TutorServiceUnavailableError
} from '../services/tutorGrounding';
import {
  generateActivityCandidate,
  ObjectiveNotFoundError,
  GenerationSettingsError
} from '../services/courseStudio';
import {
  assignInstructorToCourse,
  revokeInstructorAssignment,
  issueCourseInvitation,
  acceptCourseInvitation,
  acceptAddressedCourseInvitation,
  listAddressedCourseInvitations,
  enrollStudentDirectly,
  listCourseEnrollments,
  withdrawOrRevokeEnrollment,
  listAccessibleCourses,
  EnrollmentError
} from '../services/enrollments';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tierGate } = require('@ednova/shared/tierGate');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireMultipart } = require('@ednova/shared/middleware');
import { deleteObjectivesForDocument } from '../services/objectives';
import {
  enqueueCourseIngestionOperation,
  cancelIngestionOperation,
  retryIngestionOperation,
  reconcileIngestionOperation,
  IngestionConflictError
} from '../services/ingestionControl';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildInternalHeaders } = require('@ednova/shared/auth');

type CourseUpload = Pick<
  NonNullable<DomainRequest['file']>,
  'filename' | 'originalname' | 'mimetype' | 'size' | 'path'
>;

// express-fileupload and Multer expose incompatible ambient Request.files types.
// Read the Multer disk-upload boundary explicitly and validate the fields we consume.
function requestFileEntries(req: DomainRequest): unknown[] {
  const files: unknown = Reflect.get(req, 'files');
  if (!files) return [];
  if (Array.isArray(files)) return files;
  return typeof files === 'object' ? Object.values(files).flat() : [];
}

function courseUploads(req: DomainRequest): CourseUpload[] {
  const files = requestFileEntries(req);
  function isUpload(file: unknown): file is CourseUpload {
    return (
      !!file &&
      typeof file === 'object' &&
      'filename' in file &&
      typeof file.filename === 'string' &&
      'originalname' in file &&
      typeof file.originalname === 'string' &&
      'mimetype' in file &&
      typeof file.mimetype === 'string' &&
      'path' in file &&
      typeof file.path === 'string' &&
      'size' in file &&
      typeof file.size === 'number'
    );
  }
  if (!files.every(isUpload)) throw new Error('Invalid disk upload metadata');
  return files;
}

const router = createContracts();

// INGEST-05: move freshly-uploaded files into a course-scoped directory so the
// async worker (INGEST-06) can find them via a single unambiguous fileRef.
// Stored paths are relative to the uploads root.
function stageCourseFiles(reqFiles: CourseUpload[], courseId: string) {
  const courseUploadDir = path.join(
    process.env.INGEST_UPLOADS_DIR || 'uploads',
    'courses',
    courseId
  );
  fs.mkdirSync(courseUploadDir, { recursive: true });
  return reqFiles.map((file) => {
    const newPath = path.join(courseUploadDir, file.filename);
    fs.renameSync(file.path, newPath);
    let fileHash = '';
    try {
      const fileBuffer = fs.readFileSync(newPath);
      fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch {
      fileHash = '';
    }
    return {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      fileHash,
      path: path.relative(process.env.INGEST_UPLOADS_DIR || 'uploads', newPath).replace(/\\/g, '/')
    };
  });
}

function courseFileRef(courseId: string) {
  return path
    .join(process.env.INGEST_UPLOADS_DIR || 'uploads', 'courses', courseId)
    .replace(/\\/g, '/');
}

// SEC-11: storage filenames are server-generated and never echo the client
// name. The extension is whitelisted to a plain `[A-Za-z0-9]` suffix so no
// path separator, control char or traversal payload survives into the path.
const STORAGE_EXT_RE = /^\.[a-z0-9]{1,8}$/;

function sanitizeStoredFilename(file: Pick<NonNullable<DomainRequest['file']>, 'originalname'>) {
  const safeSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  return STORAGE_EXT_RE.test(ext) ? `${safeSuffix}${ext}` : `${safeSuffix}.bin`;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const root = process.env.INGEST_UPLOADS_DIR || 'uploads';
    fs.mkdirSync(root, { recursive: true });
    cb(null, root);
  },
  filename: (req, file, cb) => {
    cb(null, sanitizeStoredFilename(file));
  }
});

// INGEST-01: metadata (MIME + extension) allowlist, plus magic-byte sniffing.
// INGEST-02: 25MB per-file cap enforced by multer; excess → 413.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  validateUploadMetadata,
  validateUploadFile,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  SNIFF_BYTES
} = require('@ednova/shared/uploadValidation');

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    // Cheap first pass: declared MIME + extension must be allowed.
    const check = validateUploadMetadata(file);
    if (check.valid) return cb(null, true);
    const err = Object.assign(new Error(check.errors.join('; ')), { statusCode: 422 }); // sanitized message, no client-controlled content reflected
    return cb(err);
  }
});

// INGEST-02: multer size-limit violations surface as 413 (never a generic 500),
// and any file already written to disk by diskStorage is removed.
function cleanupRequestFiles(req: DomainRequest) {
  for (const file of requestFileEntries(req)) {
    if (!file || typeof file !== 'object' || !('path' in file) || typeof file.path !== 'string')
      continue;
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* best-effort cleanup */
    }
  }
}

function handleUploadError(err: unknown, req: DomainRequest, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      cleanupRequestFiles(req);
      const sizeErr = Object.assign(
        new Error(`File too large - maximum allowed is ${MAX_UPLOAD_MB}MB per file`),
        { statusCode: 413 }
      );
      return next(sizeErr);
    }
    return next(err);
  }
  return next(err);
}

const withUploadError =
  (mw: RequestHandler) => (req: DomainRequest, res: Response, next: NextFunction) =>
    mw(req, res, (err: unknown) => handleUploadError(err, req, res, next));

function streamFileSlice(filePath: string, start: number, end: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function sniffUploadedFiles(req: DomainRequest, res: Response, next: NextFunction) {
  if (!courseUploads(req) || courseUploads(req).length === 0) return next();

  const rejectAndCleanup = (files: CourseUpload[], message: string) => {
    for (const f of files) {
      try {
        fs.unlinkSync(f.path);
      } catch {
        /* best-effort cleanup */
      }
    }
    const err = Object.assign(new Error(message), { statusCode: 422 });
    return err;
  };

  try {
    // Fast path: sniff only the header, reject binaries before any full read.
    for (const file of courseUploads(req)) {
      const header = await streamFileSlice(file.path, 0, SNIFF_BYTES - 1);
      if (header.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { sniffMagicBytes } = require('@ednova/shared/uploadValidation');
        if (sniffMagicBytes(header) === 'binary') {
          return next(
            rejectAndCleanup(
              courseUploads(req),
              'Upload rejected: binary/script content is not allowed'
            )
          );
        }
      }
    }

    // Authoritative check: ensure MIME/extension match the (async) full content.
    for (const file of courseUploads(req)) {
      const buffer = await fs.promises.readFile(file.path);
      const check = validateUploadFile({
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer
      });

      if (!check.valid) {
        return next(
          rejectAndCleanup(courseUploads(req), 'Upload rejected: ' + check.errors.join('; '))
        );
      }
    }
  } catch {
    return next(rejectAndCleanup(courseUploads(req), 'Failed to read uploaded file'));
  }

  return next();
}

// Source documents are private and remain available until the course is deleted.
router.get(
  '/:courseId/files/:filename',
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      if (!(await canAuthorCourse(req.user!.userId, String(req.params.courseId))))
        return res.status(404).json({ error: 'Source file not found' });
      const course = await Course.findOne({
        _id: req.params.courseId
      }).lean();
      const filename = req.params.filename;
      if (
        !course ||
        typeof filename !== 'string' ||
        path.basename(filename) !== filename ||
        !course.files.some((file) => file.filename === filename)
      ) {
        return res.status(404).json({ error: 'Source file not found' });
      }
      const root = await fs.promises.realpath(
        path.resolve(process.env.INGEST_UPLOADS_DIR || 'uploads', 'courses', String(course._id))
      );
      const target = await fs.promises.realpath(path.join(root, filename));
      if (!target.startsWith(root + path.sep))
        return res.status(404).json({ error: 'Source file not found' });
      if (!(await canAuthorCourse(req.user!.userId, String(req.params.courseId))))
        return res.status(404).json({ error: 'Source file not found' });
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      if (req.query.inline === '1') {
        res.setHeader(
          'Content-Disposition',
          `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
        );
        return res.sendFile(target);
      }
      return res.download(target, filename);
    } catch (error) {
      if (errorDetails(error).code === 'ENOENT')
        return res.status(404).json({ error: 'Source file not found' });
      return next(error);
    }
  }
);

function handleEnrollmentError(res: Response, error: unknown) {
  if (error instanceof EnrollmentError) {
    return res.status(error.status).json({ error: error.message });
  }
  const details = errorDetails(error);
  return res.status(500).json({ error: details.message || 'Internal server error' });
}

function param(req: DomainRequest, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

// Get all courses for a user, optionally filtered by subject or institutional scope
router.get('/', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { subject_id, institution_id } = req.query;

    let courses: ICourse[] = [];
    if (institution_id && typeof institution_id === 'string') {
      courses = (await listAccessibleCourses(userId, institution_id)) as unknown as ICourse[];
    } else {
      const enrolledIds = await CourseEnrollment.find({ userId, status: 'active' }).distinct(
        'courseId'
      );
      const query: FilterQuery<ICourse> = {
        $or: [
          { userId },
          { ownerUserId: userId },
          { assignedInstructorIds: userId },
          { _id: { $in: enrolledIds } }
        ]
      };
      if (subject_id) {
        query.subjectId = subject_id;
      }
      const candidates = (await Course.find(query)
        .sort({ createdAt: -1 })
        .lean()) as unknown as ICourse[];
      for (const candidate of candidates) {
        if (await canReadCourse(userId, candidate._id.toString())) courses.push(candidate);
      }
    }

    const coursesWithDetails = courses.map((course) => ({
      id: course._id.toString(),
      title: course.title,
      description: course.description,
      scope: course.scope || 'personal',
      institutionId: course.institutionId ? course.institutionId.toString() : undefined,
      assignedInstructorIds: course.assignedInstructorIds || [],
      subjectId: course.subjectId,
      status: course.status,
      activeRevisionId: course.activeRevisionId,
      topicsCount: course.topics?.length || 0,
      filesCount: course.files?.length || 0,
      aiCourseId: course.aiCourseId,
      processedAt: course.processedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt
    }));

    res.json({ courses: coursesWithDetails });
  } catch (error) {
    if (error instanceof EnrollmentError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Error fetching courses:', error);
    res
      .status(500)
      .json({ error: 'Failed to fetch courses', details: errorDetails(error).message });
  }
});

// Create a new course (AI-powered, requires VIP+)
router.post(
  '/',
  tierGate('vip', 'vip_plus', 'trial'),
  requireMultipart,
  withUploadError(upload.array('files', 10)),
  sniffUploadedFiles,
  async (req: DomainRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { title, description, subject_id, scope, institutionId, institution_id } = req.body;

      if (!title || !subject_id) {
        return res.status(400).json({ error: 'title and subject_id are required' });
      }

      const targetInstitutionId = institutionId || institution_id;
      let courseScope = 'personal';

      if (scope === 'institutional' || targetInstitutionId) {
        if (!targetInstitutionId) {
          return res
            .status(400)
            .json({ error: 'institutionId is required for institutional courses' });
        }
        // Verify caller is instructor or admin in that institution
        const membership = await InstitutionMembership.findOne({
          institutionId: targetInstitutionId,
          userId,
          role: { $in: ['instructor', 'university_admin'] },
          status: 'active'
        });
        if (
          !membership ||
          !(await Institution.exists({ _id: targetInstitutionId, status: 'active' }))
        ) {
          return res.status(403).json({
            error:
              'Forbidden: only active instructors and administrators can create institutional courses'
          });
        }
        courseScope = 'institutional';
      }

      if (!courseUploads(req) || courseUploads(req).length === 0) {
        return res.status(400).json({ error: 'At least one file is required' });
      }

      // Verify subject exists and belongs to user
      const subject = await Subject.findOne({ _id: subject_id, userId });
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Create course record with processing status
      const course = new Course({
        title,
        description,
        subjectId: subject_id,
        userId,
        ownerUserId: userId,
        scope: courseScope,
        institutionId: courseScope === 'institutional' ? targetInstitutionId : undefined,
        assignedInstructorIds: courseScope === 'institutional' ? [userId] : [],
        status: 'processing',
        files: courseUploads(req).map((file: CourseUpload) => ({
          filename: file.filename,
          originalName: file.originalname,
          size: file.size
        }))
      });

      await course.save();

      // INGEST-05: stage files under a course-scoped dir, then enqueue the
      // async ingestion job. The request returns 202 { jobId } immediately —
      // the worker (INGEST-06) parses/embeds and resolves the course status.
      const staged = stageCourseFiles(courseUploads(req), course._id.toString());
      const revisionTag = `rev_${crypto.randomUUID().replace(/-/g, '')}`;
      const fileHashes = staged.map((f) => f.fileHash).filter(Boolean);
      const contentHash = crypto
        .createHash('sha256')
        .update(fileHashes.sort().join(':') || course._id.toString())
        .digest('hex');

      course.files = staged.map((file) => ({
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        fileHash: file.fileHash,
        uploadedAt: new Date()
      }));

      await course.save();
      await CourseRevision.create({
        courseId: course._id,
        revisionTag,
        contentHash,
        status: 'draft',
        isInstructorReviewed: false,
        sourceManifest: await captureImmutableSources(course._id.toString(), course.files, '2.0'),
        vectorIndexRef: `faiss/${course._id.toString()}/${revisionTag}.faiss`
      });

      try {
        const { jobId } = await enqueueCourseIngestionOperation(
          {
            userId,
            courseId: course._id.toString(),
            courseTitle: course.title,
            revisionId: revisionTag,
            fileRef: courseFileRef(course._id.toString()),
            files: staged,
            requestId: req.get('X-Request-ID')
          },
          course.jobId
        );

        console.log('Ingestion job triggered:', jobId);
        return res.status(202).json({
          jobId,
          courseId: course._id.toString(),
          status: 'processing'
        });
      } catch (publishErr) {
        console.error('Ingestion job enqueue failed:', errorDetails(publishErr).message);

        // Retain bytes and the durable operation: a lost broker acknowledgement
        // can follow successful publication. Reconciliation reuses its identity.
        if (publishErr instanceof IngestionConflictError)
          return res.status(409).json({ error: publishErr.code });

        return res.status(503).json({ error: 'AI job bus unavailable, retry later' });
      }
    } catch (error) {
      console.error('Error creating course:', error);
      res.status(500).json({ error: 'Failed to create course' });
    }
  }
);

// Get a specific course
router.get('/invitations/inbox', async (req: DomainRequest, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await listAddressedCourseInvitations(req.user?.email));
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

router.get('/:courseId', async (req: DomainRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.userId;

    const authorized = await canReadCourse(userId, courseId);
    if (!authorized) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({
      course: {
        id: course._id.toString(),
        title: course.title,
        description: course.description,
        scope: course.scope || 'personal',
        institutionId: course.institutionId ? course.institutionId.toString() : undefined,
        assignedInstructorIds: course.assignedInstructorIds || [],
        subjectId: course.subjectId,
        status: course.status,
        activeRevisionId: course.activeRevisionId,
        topics: course.topics,
        files: course.files,
        aiCourseId: course.aiCourseId,
        processedAt: course.processedAt,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// ED-30: Get course draft hierarchy and objectives
router.get('/:courseId/draft', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const userId = req.user!.userId;

    const draft = await getCourseDraft(userId, courseId);
    res.json({ draft });
  } catch (error) {
    if (error instanceof DraftForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof DraftNotFoundError) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    console.error('Error fetching course draft:', error);
    res.status(500).json({ error: 'Failed to fetch course draft' });
  }
});

// ED-30: Update course draft with optimistic concurrency control
router.put('/:courseId/draft', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const userId = req.user!.userId;
    const {
      expectedRevisionTag,
      topics,
      summary,
      isInstructorReviewed,
      extractionReviewAcknowledged
    } = req.body;

    const result = await updateCourseDraft(userId, courseId, {
      expectedRevisionTag,
      topics,
      summary,
      isInstructorReviewed,
      extractionReviewAcknowledged
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof DraftForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof DraftNotFoundError) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error instanceof StaleRevisionError) {
      return res.status(409).json({
        error: 'STALE_REVISION',
        message: error.message,
        currentRevisionTag: error.currentRevisionTag
      });
    }
    if (error instanceof HierarchyValidationError) {
      return res.status(400).json({ error: 'INVALID_HIERARCHY', message: error.message });
    }
    console.error('Error updating course draft:', error);
    res.status(500).json({ error: 'Failed to update course draft' });
  }
});

// Advisory automated review of the editable draft. Read-only: it never saves,
// acknowledges source review or publishes.
router.post('/:courseId/draft/review', async (req: DomainRequest, res: Response) => {
  try {
    const review = await reviewCourseDraft(req.user!.userId, String(req.params.courseId), {
      useAi: req.body?.useAi === true
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({ review });
  } catch (error) {
    if (error instanceof DraftForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof DraftNotFoundError) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    console.error('Error reviewing course draft:', error);
    res.status(500).json({ error: 'Failed to review course draft' });
  }
});

router.post('/:courseId/draft/sources/prepare', async (req: DomainRequest, res: Response) => {
  try {
    const result = await prepareRevisionSources(
      req.user!.userId,
      String(req.params.courseId),
      String(req.body?.expectedRevisionTag || '')
    );
    res.status(200).json(result);
  } catch (error) {
    const status = (error as { status?: number }).status;
    res.status(status === 403 ? 403 : status === 409 ? 409 : 503).json({
      error:
        status === 409
          ? 'STALE_REVISION'
          : status === 403
            ? 'FORBIDDEN'
            : 'SOURCE_INTEGRITY_UNAVAILABLE'
    });
  }
});

// ED-05: Publish reviewed course draft revision
router.post('/:courseId/drafts/:revisionId/approve', async (req: DomainRequest,res: Response) => {
  try {
    const actor=req.user?.userId,courseId=String(req.params.courseId),tag=String(req.params.revisionId);
    const draft=await formulaJobs.snapshot(actor,courseId,tag,req.body?.draftVersion);
    const canonical=draft.contentDocument as any;
    if(canonical?.quality?.publicationState==='review_required' && !canonical.extractionReview?.acknowledged && req.body?.extractionReviewAcknowledged!==true) return res.status(400).json({error:'EXTRACTION_REVIEW_REQUIRED'});
    const next=req.body?.extractionReviewAcknowledged===true ? withExtractionReview(canonical) : canonical;
    const changed=await CourseRevision.updateOne({_id:draft._id,revisionTag:tag,__v:draft.__v,status:'draft',activationState:{$exists:false}},{$set:{isInstructorReviewed:true,...(next?{contentDocument:next,contentDocumentHash:activityDigest(next)}:{})}});
    if(!changed.matchedCount)return res.status(409).json({error:'DRAFT_CHANGED'});
    return res.status(200).json({approved:true});
  }catch(e){return res.status((e as any).status||503).json({error:(e as any).status?(e as Error).message:'APPROVAL_UNAVAILABLE'});}
});

router.post('/:courseId/publish', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const userId = req.user!.userId;
    const { expectedRevisionTag } = req.body || {};

    const result = await publishCourseRevision(userId, courseId, expectedRevisionTag);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof PublicationNotFoundError) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error instanceof PublicationConflictError) {
      return res.status(409).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationReviewRequiredError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    if (error instanceof SourceIntegrityError) return res.status(503).json({ error: error.code });
    if ((error as any).code === 'FORMULA_SNAPSHOT_CHANGED') return res.status(409).json({error:'Formula source or draft changed. Reload Studio and review this draft again.',code:'FORMULA_SNAPSHOT_CHANGED'});
    if ((error as { status?: number }).status === 422) return res.status(422).json({error:'Reviewed formula validation failed. Review a fresh proposal.'});
    if ((error as { status?: number }).status === 409)
      return res.status(409).json({ error: 'STALE_REVISION' });
    console.error('Error publishing course revision:', error);
    res.status(500).json({ error: 'Failed to publish course revision' });
  }
});

// ED-05 / Contract 03: Authoritative published course context
router.get('/:courseId/published-context', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const userId = req.user!.userId;
    const revisionId = typeof req.query.revisionId === 'string' ? req.query.revisionId : undefined;

    const context = await getPublishedCourseContext(userId, courseId, revisionId);
    res.json(context);
  } catch (error) {
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof UnpublishedCourseError) {
      return res.status(404).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationNotFoundError) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    console.error('Error fetching published course context:', error);
    res.status(500).json({ error: 'Failed to fetch published course context' });
  }
});

// ED-05: Server-only source resolution with index reference
router.get('/:courseId/source-resolution', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const userId = req.user!.userId;
    const revisionId = typeof req.query.revisionId === 'string' ? req.query.revisionId : undefined;

    const resolution = await resolveCourseSource(userId, courseId, revisionId);
    res.json(resolution);
  } catch (error) {
    if (error instanceof SourceIntegrityError) return res.status(503).json({ error: error.code });
    if ((error as { status?: number }).status === 409)
      return res.status(409).json({ error: 'STALE_REVISION' });
    console.error('Error resolving course source:', error);
    res.status(500).json({ error: 'Failed to resolve course source' });
  }
});

// ED-10 / Contract 03: Source-grounded tutor Q&A
router.post('/:courseId/tutor/ask', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const userId = req.user!.userId;
    const { question, topicId, objectiveId, revisionId } = req.body || {};

    const result = await askGroundedTutor(userId, courseId, {
      question,
      revisionId,
      topicId,
      objectiveId
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof TutorValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof UnpublishedCourseError) {
      return res.status(404).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationNotFoundError) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error instanceof TutorServiceUnavailableError) {
      return res.status(503).json({ error: error.code, message: error.message });
    }
    console.error('Error answering tutor question:', error);
    res.status(500).json({ error: 'Failed to answer tutor question' });
  }
});

// ED-32 / ED-31: Course Studio - Generate grounded activity proposal candidate
router.post('/:courseId/studio/generate-activity', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const userId = req.user!.userId;
    const {
      objectiveId,
      activityType,
      title,
      instructions,
      expectedRevisionTag,
      sourceChunkId,
      language,
      difficulty,
      hintDepth,
      sourceSectionId
    } = req.body || {};

    if (!objectiveId || !activityType) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'objectiveId and activityType are required'
      });
    }

    if (activityType !== 'InteractiveQuiz' && activityType !== 'GuidedProblem') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'activityType must be either InteractiveQuiz or GuidedProblem'
      });
    }

    if (
      Object.keys(req.body || {}).some(
        (key) =>
          ![
            'objectiveId',
            'activityType',
            'title',
            'instructions',
            'expectedRevisionTag',
            'sourceChunkId',
            'language',
            'difficulty',
            'hintDepth',
            'sourceSectionId'
          ].includes(key)
      )
    )
      return res.status(400).json({ error: 'INVALID_SOURCE_CLAIM' });

    const candidate = await generateActivityCandidate(userId, courseId, {
      objectiveId,
      activityType,
      title,
      instructions,
      expectedRevisionTag,
      sourceChunkId,
      language,
      difficulty,
      hintDepth,
      sourceSectionId
    });

    res.status(200).json(candidate);
  } catch (error) {
    if (error instanceof GenerationSettingsError)
      return res.status(400).json({ error: error.code, message: error.message });
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof DraftNotFoundError) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error instanceof ObjectiveNotFoundError) {
      return res.status(404).json({ error: 'OBJECTIVE_NOT_FOUND', message: error.message });
    }
    if (error instanceof SourceIntegrityError) return res.status(503).json({ error: error.code });
    if ((error as { status?: number }).status === 409)
      return res.status(409).json({ error: 'STALE_REVISION' });
    console.error('Error generating activity candidate:', error);
    res.status(500).json({ error: 'Failed to generate activity candidate' });
  }
});

router.get(
  '/:courseId/revisions/:revisionId/sources/:documentId',
  async (req: DomainRequest, res: Response) => {
    try {
      const courseId = String(req.params.courseId),
        revisionId = String(req.params.revisionId);
      const resolution = await resolveCourseSource(req.user!.userId, courseId, revisionId);
      if (resolution.access.decision !== 'allowed')
        return res.status(403).json({ error: 'FORBIDDEN' });
      const revision = await CourseRevision.findOne({ courseId, revisionTag: revisionId }).lean();
      if (!revision) return res.status(404).json({ error: 'NOT_FOUND' });
      const artifact = await verifyRevisionArtifact(revision),
        document = artifact.metadata.documents.find(
          (d) => d.documentId === String(req.params.documentId)
        );
      if (!document) return res.status(404).json({ error: 'NOT_FOUND' });
      const file = await verifyBlob(document);
      if (!(await canReadCourse(req.user!.userId, courseId)))
        return res.status(403).json({ error: 'FORBIDDEN' });
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      return res.download(file, document.filename);
    } catch {
      return res.status(503).json({ error: 'SOURCE_INTEGRITY_UNAVAILABLE' });
    }
  }
);

router.get('/:courseId/drafts/:revisionId/formula-workspace', async (req: DomainRequest, res: Response) => {
  try {
    const actor = req.user?.userId, courseId = String(req.params.courseId), tag = String(req.params.revisionId);
    if (!actor) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (!(await canManageCourse(actor, courseId))) return res.status(403).json({ error: 'FORBIDDEN' });
    const draft = await findEditableDraft(courseId);
    if (!draft || draft.revisionTag !== tag || draft.revokedAt) return res.status(409).json({ error: 'DRAFT_CHANGED' });
    const course = await Course.findById(courseId).lean();
    const document = draft.contentDocument ? parseCanonicalDocument(draft.contentDocument) : null;
    const regions = (document?.chapters || []).flatMap(ch => ch.lessons.flatMap(lesson => lesson.blocks.filter(b => b.type === 'math').map(b => {
      const block = b as Record<string, any>;
      const documentId = block.evidence?.[0]?.documentId;
      return { regionId: block.regionId, documentId, page: block.page, text: typeof block.expression === 'string' ? block.expression.slice(0,8000) : '', warnings: Array.isArray(block.issues) ? block.issues.filter((w: unknown) => typeof w === 'string').slice(0,12).map((w: string) => w.slice(0,500)) : [] };
    }))).filter(r => typeof r.regionId === 'string' && draft.sourceManifest?.some(d => d.documentId === r.documentId)).slice(0, 200);
    const [proposals, jobs] = await Promise.all([
      FormulaProposal.find({ courseId, revisionId: draft._id, draftVersion: draft.__v }).limit(200).lean(),
      FormulaRecognitionJob.find({ courseId, revisionId: String(draft._id), draftVersion: draft.__v }).sort({ createdAt: -1 }).limit(200).lean(),
    ]);
    await ensureSnapshot(actor, draft);
    return res.json({ draftVersion: draft.__v, revisionTag: tag, canConsent: !!course && [course.ownerUserId, course.userId].includes(actor), regions, proposals, jobs, staleFormulaReviews: await FormulaProposal.countDocuments({courseId,state:{$in:['accepted','corrected']},$or:[{revisionId:{$ne:draft._id}},{revisionTag:{$ne:tag}},{draftVersion:{$ne:draft.__v}}]}) });
  } catch (e) { return res.status((e as any).status || 503).json({ error: (e as any).status ? (e as Error).message : 'FORMULA_WORKSPACE_UNAVAILABLE' }); }
});

router.post('/:courseId/drafts/:revisionId/formula-consent', async (req: DomainRequest, res: Response) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (req.body?.consent !== true) return res.status(422).json({ error: 'EXPLICIT_CONSENT_REQUIRED' });
    return res.json(await formulaJobs.consent(req.user.userId, String(req.params.courseId), String(req.params.revisionId), req.body.draftVersion, req.body.documentId));
  } catch (e) { const status = (e as any).status || 503; return res.status(status).json({ error: status === 503 ? 'CONSENT_UNAVAILABLE' : (e as Error).message }); }
});
router.post('/:courseId/drafts/:revisionId/recognition-jobs', async (req: DomainRequest, res: Response) => {
  try {
    const job = await formulaJobs.submit(req.user?.userId || '', String(req.params.courseId), String(req.params.revisionId), req.body);
    return res.status(202).json({ job });
  } catch (e) { const status = (e as any).status || 503; return res.status(status).json({ error: (e as any).status ? (e as Error).message : 'RECOGNITION_UNAVAILABLE' }); }
});
router.get('/:courseId/drafts/:revisionId/recognition-jobs/:jobId', async (req: DomainRequest, res: Response) => {
  try { return res.json({ job: await formulaJobs.status(req.user?.userId || '', String(req.params.courseId), String(req.params.revisionId), String(req.params.jobId)) }); }
  catch (e) { const status = (e as any).status || 503; return res.status(status).json({ error: status === 503 ? 'JOB_UNAVAILABLE' : (e as Error).message }); }
});
router.post('/:courseId/drafts/:revisionId/recognition-jobs/:jobId/cancel', async (req: DomainRequest, res: Response) => {
  try { return res.json({ job: await formulaJobs.cancel(req.user?.userId || '', String(req.params.courseId), String(req.params.revisionId), String(req.params.jobId)) }); }
  catch (e) { const status = (e as any).status || 503; return res.status(status).json({ error: status === 503 ? 'JOB_UNAVAILABLE' : (e as Error).message }); }
});

router.post('/:courseId/drafts/:revisionId/formula-proposals/test', async (req: DomainRequest, res: Response) => {
  if (process.env.NODE_ENV !== 'test' || process.env.FORMULA_MOCK_PROVIDER !== '1')
    return res.status(404).json({ error: 'NOT_FOUND' });
  try {
    const courseId = String(req.params.courseId), revisionId = String(req.params.revisionId);
    const { documentId, regionId, draftVersion } = req.body || {};
    if (Object.keys(req.body || {}).some(k => !['documentId', 'regionId', 'draftVersion'].includes(k)) ||
        !/^[a-f0-9]{24}$/.test(courseId) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(revisionId) ||
        typeof documentId !== 'string' || !/^doc_[a-f0-9]{16}$/.test(documentId) ||
        typeof regionId !== 'string' || !/^region_[a-f0-9]{20}$/.test(regionId) ||
        !Number.isSafeInteger(draftVersion) || draftVersion < 0)
      return res.status(422).json({ error: 'INVALID_REQUEST' });
    if (!req.user?.userId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (!(await canManageCourse(req.user.userId, courseId))) return res.status(403).json({ error: 'FORBIDDEN' });
    const draft = await CourseRevision.findOne({ courseId, revisionTag: revisionId, status: 'draft', revokedAt: { $exists: false } }).lean();
    if (!draft || draft.__v !== draftVersion) return res.status(409).json({ error: 'DRAFT_CHANGED' });
    if (String((await findEditableDraft(courseId))?._id) !== String(draft._id)) return res.status(409).json({ error: 'DRAFT_CHANGED' });
    const documents = draft.sourceManifest || [];
    if (!documents.length || documents.some(d => !d.storageRef || !d.mediaType))
      return res.status(503).json({ error: 'SOURCE_INTEGRITY_UNAVAILABLE' });
    const sources = documents as SourceDocument[];
    const doc = sources.find(d => d.documentId === documentId);
    if (!doc || doc.mediaType !== 'application/pdf') return res.status(404).json({ error: 'NOT_FOUND' });
    await verifyBlob(doc);
    const contentHash = 'sha256:' + draft.contentHash.replace(/^sha256:/, '');
    const output = await aiClient.post('/api/ai/sources/validate-formula-proposal', {
      schemaVersion: '1.0.0', courseId, revisionId, contentHash, documents: sources,
      manifestDigest: manifestDigest(courseId, revisionId, contentHash, sources), documentId, regionId,
    }, { timeout: 30_000 });
    const { region, proposal } = output.data || {};
    if (!region || region.documentId !== documentId || region.documentHash !== doc.contentHash ||
        region.regionId !== regionId || !Number.isSafeInteger(region.page) || region.page < 1 ||
        !Array.isArray(region.bbox) || region.bbox.length !== 4 || !region.bbox.every(Number.isFinite) ||
        typeof region.text !== 'string' || !region.text || region.text.length > 8000 ||
        !/^sha256:[a-f0-9]{64}$/.test(region.cropHash) || proposal?.provider !== 'mock' ||
        proposal?.model !== 'mock-v1' || proposal?.review_disposition !== 'pending' ||
        proposal?.response?.status !== 'proposed' || proposal?.response?.content !== 'x^2' ||
        !Array.isArray(proposal?.validation?.syntax_warnings))
      return res.status(503).json({ error: 'SOURCE_INTEGRITY_UNAVAILABLE' });
    if (!(await canManageCourse(req.user.userId, courseId)) || !(await CourseRevision.exists({
      _id: draft._id, courseId, revisionTag: revisionId, status: 'draft', __v: draftVersion, revokedAt: { $exists: false },
    }))) return res.status(409).json({ error: 'DRAFT_CHANGED' });
    const identity = 'sha256:' + crypto.createHash('sha256').update(JSON.stringify([
      courseId, String(draft._id), revisionId, draftVersion, documentId, doc.contentHash,
      regionId, region.cropHash, 'mock', 'mock-v1', 'x^2',
    ])).digest('hex');
    const payload = {
      identity, courseId, revisionId: draft._id, revisionTag: revisionId, draftVersion,
      documentId, documentHash: doc.contentHash, regionId, page: region.page, bbox: region.bbox,
      sourceText: region.text, cropHash: region.cropHash, provider: 'mock', model: 'mock-v1',
      latex: 'x^2', warnings: proposal.validation.syntax_warnings, state: 'pending', reviewVersion: 0, history: [],
    };
    let saved;
    try {
      saved = await FormulaProposal.findOneAndUpdate({ identity }, { $setOnInsert: payload }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      saved = await FormulaProposal.findOne({ identity }).lean();
    }
    if (!saved || Array.isArray(saved) || ['courseId', 'revisionId', 'revisionTag', 'draftVersion', 'documentId', 'documentHash', 'regionId', 'page', 'cropHash', 'provider', 'model', 'latex', 'sourceText'].some(key => String((saved as any)[key]) !== String((payload as any)[key])) || JSON.stringify(saved.bbox) !== JSON.stringify(payload.bbox))
      return res.status(409).json({ error: 'PROPOSAL_IDENTITY_CONFLICT' });
    if (!(await canManageCourse(req.user.userId, courseId)) ||
        String((await findEditableDraft(courseId))?._id) !== String(draft._id) ||
        !(await CourseRevision.exists({ _id: draft._id, courseId, revisionTag: revisionId, status: 'draft', __v: draftVersion, revokedAt: { $exists: false } })))
      return res.status(409).json({ error: 'DRAFT_CHANGED' });
    return res.status(200).json({ proposal: saved });
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    return res.status(status === 404 || status === 422 ? status : 503).json({ error: 'SOURCE_REGION_UNAVAILABLE' });
  }
});

router.post('/:courseId/drafts/:revisionId/formula-proposals/:proposalId/review', async (req: DomainRequest, res: Response) => {
  try {
    const { action, reviewVersion, draftVersion, latex } = req.body || {};
    if (Object.keys(req.body || {}).some(k => !['action', 'reviewVersion', 'draftVersion', 'latex'].includes(k)) ||
        !['accept', 'correct', 'reject'].includes(action) || !Number.isSafeInteger(reviewVersion) || reviewVersion < 0 ||
        !Number.isSafeInteger(draftVersion) || draftVersion < 0 || (action !== 'correct' && latex !== undefined)) fail(422, 'INVALID_REQUEST');
    const actor = req.user?.userId;
    const { draft, proposal } = await reviewContext(actor, String(req.params.courseId), String(req.params.revisionId), String(req.params.proposalId));
    if (draftVersion !== draft.__v || proposal.reviewVersion !== reviewVersion || proposal.state !== 'pending') fail(409, 'REVIEW_CONFLICT');
    const state = { accept: 'accepted', correct: 'corrected', reject: 'rejected' }[action as 'accept' | 'correct' | 'reject']!;
    const expression = action === 'correct' ? validateCorrection(latex) : action === 'accept' ? validateCorrection(proposal.latex) : undefined;
    await ensureSnapshot(actor!, draft);
    const updated = await FormulaProposal.findOneAndUpdate({ _id: proposal._id, courseId: draft.courseId,
      revisionId: draft._id, revisionTag: draft.revisionTag, draftVersion, state: 'pending', reviewVersion }, {
      $set: { state, ...(expression !== undefined ? { reviewedLatex: expression } : {}) },
      $inc: { reviewVersion: 1 },
      $push: { history: { reviewer: actor, action: state, previous: 'pending', next: state,
        ...(action === 'correct' ? { expression } : {}), at: new Date(), draftVersion,
        revisionTag: draft.revisionTag, revisionId: String(draft._id), reviewVersion: reviewVersion + 1 } },
    }, { new: true, runValidators: true }).lean();
    if (!updated) fail(409, 'REVIEW_CONFLICT');
    await ensureSnapshot(actor!, draft);
    return res.status(200).json({ proposal: updated });
  } catch (error) { const status = (error as { status?: number }).status || 503; return res.status(status).json({ error: status === 503 ? 'REVIEW_UNAVAILABLE' : (error as Error).message }); }
});

router.get('/:courseId/drafts/:revisionId/formula-proposals/:proposalId/history', async (req: DomainRequest, res: Response) => {
  try {
    const { draft, proposal } = await reviewContext(req.user?.userId, String(req.params.courseId), String(req.params.revisionId), String(req.params.proposalId));
    await ensureSnapshot(req.user!.userId, draft);
    return res.json({ history: proposal.history, reviewVersion: proposal.reviewVersion, state: proposal.state });
  } catch (error) { const status = (error as { status?: number }).status || 503; return res.status(status).json({ error: status === 503 ? 'REVIEW_UNAVAILABLE' : (error as Error).message }); }
});

router.get('/:courseId/drafts/:revisionId/formula-proposals/:proposalId', async (req: DomainRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId), revisionId = String(req.params.revisionId), proposalId = String(req.params.proposalId);
    if (!req.user?.userId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
    if (!/^[a-f0-9]{24}$/.test(courseId) || !/^[a-f0-9]{24}$/.test(proposalId)) return res.status(422).json({ error: 'INVALID_REQUEST' });
    if (!(await canManageCourse(req.user.userId, courseId))) return res.status(403).json({ error: 'FORBIDDEN' });
    const draft = await CourseRevision.findOne({ courseId, revisionTag: revisionId, status: 'draft', revokedAt: { $exists: false } }).lean();
    if (!draft) return res.status(409).json({ error: 'DRAFT_CHANGED' });
    if (String((await findEditableDraft(courseId))?._id) !== String(draft._id)) return res.status(409).json({ error: 'DRAFT_CHANGED' });
    const proposal = await FormulaProposal.findOne({ _id: proposalId, courseId, revisionId: draft._id,
      revisionTag: revisionId }).lean();
    if (!proposal || Array.isArray(proposal)) return res.status(404).json({ error: 'NOT_FOUND' });
    if (proposal.draftVersion !== draft.__v) return res.status(409).json({ error: 'DRAFT_CHANGED' });
    if (!(await canManageCourse(req.user.userId, courseId)) || !(await CourseRevision.exists({ _id: draft._id, status: 'draft', __v: draft.__v, revisionTag: revisionId })))
      return res.status(409).json({ error: 'DRAFT_CHANGED' });
    return res.status(200).json({ proposal });
  } catch { return res.status(503).json({ error: 'PROPOSAL_UNAVAILABLE' }); }
});

router.get(
  '/:courseId/drafts/:revisionId/sources/:documentId/regions/:regionId',
  async (req: DomainRequest, res: Response) => {
    try {
      const courseId = String(req.params.courseId), revisionId = String(req.params.revisionId),
        documentId = String(req.params.documentId), regionId = String(req.params.regionId);
      if (!/^[a-f0-9]{24}$/.test(courseId) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(revisionId) ||
          !/^doc_[a-f0-9]{16}$/.test(documentId) || !/^region_[a-f0-9]{20}$/.test(regionId))
        return res.status(422).json({ error: 'INVALID_SOURCE_REGION' });
      if (!(await canManageCourse(req.user!.userId, courseId)))
        return res.status(403).json({ error: 'FORBIDDEN' });
      const draft = await CourseRevision.findOne({ courseId, revisionTag: revisionId, status: 'draft', revokedAt: { $exists: false } }).lean();
      if (!draft) return res.status(404).json({ error: 'NOT_FOUND' });
      const documents = draft.sourceManifest || [];
      if (!documents.length || documents.some((item) => !item.storageRef || !item.mediaType))
        return res.status(503).json({ error: 'SOURCE_INTEGRITY_UNAVAILABLE' });
      const sourceDocuments = documents as SourceDocument[];
      const document = sourceDocuments.find((item) => item.documentId === documentId);
      if (!document || document.mediaType !== 'application/pdf')
        return res.status(404).json({ error: 'NOT_FOUND' });
      await verifyBlob(document);
      const contentHash = 'sha256:' + draft.contentHash.replace(/^sha256:/, '');
      const digest = manifestDigest(courseId, revisionId, contentHash, sourceDocuments);
      const crop = await aiClient.post('/api/ai/sources/region-crop', {
        schemaVersion: '1.0.0', courseId, revisionId, contentHash,
        documents: sourceDocuments, manifestDigest: digest, documentId, regionId,
      }, { responseType: 'arraybuffer', timeout: 30_000 });
      if (crop.headers['content-type'] !== 'image/png')
        return res.status(503).json({ error: 'SOURCE_REGION_UNAVAILABLE' });
      if (!(await canManageCourse(req.user!.userId, courseId)) ||
          !(await CourseRevision.exists({ _id: draft._id, status: 'draft', __v: draft.__v, revokedAt: { $exists: false } })))
        return res.status(409).json({ error: 'DRAFT_CHANGED' });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      return res.status(200).send(Buffer.from(crop.data));
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      return res.status(status === 404 || status === 422 ? status : 503)
        .json({ error: status === 422 ? 'INVALID_SOURCE_REGION' : 'SOURCE_REGION_UNAVAILABLE' });
    }
  }
);

router.get(
  '/:courseId/revisions/:revisionId/sources/:documentId/regions/:regionId',
  async (req: DomainRequest, res: Response) => {
    try {
      const courseId = String(req.params.courseId),
        revisionId = String(req.params.revisionId),
        documentId = String(req.params.documentId),
        regionId = String(req.params.regionId);
      if (
        !/^doc_[a-f0-9]{16}$/.test(documentId) ||
        !/^region_[a-f0-9]{20}$/.test(regionId)
      )
        return res.status(422).json({ error: 'INVALID_SOURCE_REGION' });
      const resolution = await resolveCourseSource(req.user!.userId, courseId, revisionId);
      if (resolution.access.decision !== 'allowed')
        return res.status(403).json({ error: 'FORBIDDEN' });
      const revision = await CourseRevision.findOne({
        courseId,
        revisionTag: revisionId,
        status: { $in: ['published', 'deprecated'] },
        activationState: 'committed',
        revokedAt: { $exists: false },
      }).lean();
      if (!revision) return res.status(404).json({ error: 'NOT_FOUND' });
      const artifact = await verifyRevisionArtifact(revision);
      const document = artifact.metadata.documents.find((item) => item.documentId === documentId);
      if (!document || document.mediaType !== 'application/pdf')
        return res.status(404).json({ error: 'NOT_FOUND' });
      const contentHash = 'sha256:' + revision.contentHash.replace(/^sha256:/, '');
      const digest = manifestDigest(courseId, revisionId, contentHash, artifact.metadata.documents);
      if (!(await canReadCourse(req.user!.userId, courseId)))
        return res.status(403).json({ error: 'FORBIDDEN' });
      const crop = await aiClient.post(
        '/api/ai/sources/region-crop',
        {
          schemaVersion: '1.0.0',
          courseId,
          revisionId,
          contentHash,
          documents: artifact.metadata.documents,
          manifestDigest: digest,
          documentId,
          regionId,
          view: 'math_context',
        },
        { responseType: 'arraybuffer', timeout: 30_000 },
      );
      if (crop.headers['content-type'] !== 'image/png')
        return res.status(503).json({ error: 'SOURCE_REGION_UNAVAILABLE' });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      return res.status(200).send(Buffer.from(crop.data));
    } catch (error) {
      if (error instanceof SourceIntegrityError)
        return res.status(503).json({ error: error.code });
      const status = (error as { response?: { status?: number } }).response?.status;
      return res
        .status(status === 404 || status === 422 ? status : 503)
        .json({ error: status === 422 ? 'INVALID_SOURCE_REGION' : 'SOURCE_REGION_UNAVAILABLE' });
    }
  }
);

// INGEST-07: current ingestion progress + status for a course
router.get('/:courseId/ingest-status', async (req: DomainRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.userId;

    const authorized = await canReadCourse(userId, courseId);
    if (!authorized) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildIngestStatus } = require('../services/ingestStatus');
    res.json(buildIngestStatus(course));
  } catch (error) {
    console.error('Error fetching ingest status:', error);
    res.status(500).json({ error: 'Failed to fetch ingest status' });
  }
});

// Delete a course
router.delete('/:courseId', async (req: DomainRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = req.user!.userId;

    const authorized = await canManageCourse(userId, courseId);
    if (!authorized) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = await Course.findByIdAndDelete(courseId);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // BLOOM-06: remove learning objectives for deleted course
    try {
      await deleteObjectivesForDocument(course._id.toString());
    } catch (objErr) {
      console.warn('Learning objective cleanup failed (non-fatal):', errorDetails(objErr).message);
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

for (const [action, execute] of Object.entries({
  cancel: cancelIngestionOperation,
  retry: retryIngestionOperation,
  reconcile: reconcileIngestionOperation
})) {
  router.post(`/:courseId/ingestion/${action}`, async (req: DomainRequest, res: Response) => {
    try {
      if (!req.body || Object.keys(req.body).some((key) => key !== 'expectedJobId'))
        return res.status(400).json({ error: 'INVALID_INGESTION_COMMAND' });
      const result = await execute(
        req.user!.userId,
        String(req.params.courseId),
        req.body.expectedJobId
      );
      if (!(await canManageCourse(req.user!.userId, String(req.params.courseId))))
        return res.status(403).json({ error: 'FORBIDDEN' });
      return res.status(action === 'retry' ? 202 : 200).json(result);
    } catch (error) {
      const status = (error as { status?: number }).status;
      return res.status(status === 403 ? 403 : status === 409 ? 409 : 503).json({
        error:
          status === 403
            ? 'FORBIDDEN'
            : status === 409
              ? 'INGESTION_CONFLICT'
              : 'INGESTION_CONTROL_UNAVAILABLE'
      });
    }
  });
}

// Add files to an existing course (AI re-processing)
router.post(
  '/:courseId/files',
  tierGate('vip', 'vip_plus', 'trial'),
  requireMultipart,
  withUploadError(upload.array('files', 10)),
  sniffUploadedFiles,
  async (req: DomainRequest, res: Response) => {
    try {
      const { courseId } = req.params;
      const userId = req.user!.userId;

      if (!courseUploads(req) || courseUploads(req).length === 0) {
        return res.status(400).json({ error: 'At least one file is required' });
      }

      // Find the course
      const authorized = await canManageCourse(userId, courseId);
      if (!authorized) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (course.status === 'processing') {
        return res.status(409).json({
          error:
            'Course is currently processing. Cancel or wait for completion before replacing files.',
          code: 'INGESTION_CONFLICT'
        });
      }

      // INGEST-05: stage the newly added files and enqueue async re-processing.
      const staged = stageCourseFiles(courseUploads(req), course._id.toString());
      const revisionTag = `rev_${crypto.randomUUID().replace(/-/g, '')}`;
      const newFiles = staged.map((file) => ({
        filename: file.filename,
        originalName: file.originalName,
        size: file.size,
        fileHash: file.fileHash,
        uploadedAt: new Date()
      }));

      const originalFiles = [...(course.files || [])];
      course.files.push(...newFiles);
      const allFileHashes = course.files
        .map((f: { fileHash?: string }) => f.fileHash)
        .filter(Boolean);
      const contentHash = crypto
        .createHash('sha256')
        .update(allFileHashes.sort().join(':') || course._id.toString())
        .digest('hex');

      await course.save();
      await CourseRevision.create({
        courseId: course._id,
        revisionTag,
        contentHash,
        status: 'draft',
        isInstructorReviewed: false,
        sourceManifest: await captureImmutableSources(course._id.toString(), course.files, '2.0'),
        vectorIndexRef: `faiss/${course._id.toString()}/${revisionTag}.faiss`
      });

      try {
        const { jobId } = await enqueueCourseIngestionOperation(
          {
            userId,
            courseId: course._id.toString(),
            courseTitle: course.title,
            revisionId: revisionTag,
            fileRef: courseFileRef(course._id.toString()),
            files: staged,
            requestId: req.get('X-Request-ID')
          },
          course.jobId
        );

        return res.status(202).json({
          jobId,
          courseId: course._id.toString(),
          status: 'processing'
        });
      } catch (publishErr) {
        console.error('Ingestion job enqueue failed:', errorDetails(publishErr).message);
        if (publishErr instanceof IngestionConflictError) {
          await Course.updateOne({ _id: course._id }, { $set: { files: originalFiles } });
          await CourseRevision.deleteOne({ courseId: course._id, revisionTag });
          return res.status(409).json({ error: publishErr.code });
        }
        // Failed and uncertain replacement bytes are retained for reconciliation.

        return res.status(503).json({ error: 'AI job bus unavailable, retry later' });
      }
    } catch (error) {
      console.error('Error adding files to course:', error);
      res.status(500).json({ error: 'Failed to add files to course' });
    }
  }
);

// Create a manual course (no AI processing, available to all tiers including Normal)
router.post('/manual', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { title, description, subject_id, topics, scope, institutionId, institution_id } =
      req.body;

    if (!title || !subject_id) {
      return res.status(400).json({ error: 'title and subject_id are required' });
    }

    const targetInstitutionId = institutionId || institution_id;
    let courseScope = 'personal';

    if (scope === 'institutional' || targetInstitutionId) {
      if (!targetInstitutionId) {
        return res
          .status(400)
          .json({ error: 'institutionId is required for institutional courses' });
      }
      const membership = await InstitutionMembership.findOne({
        institutionId: targetInstitutionId,
        userId,
        role: { $in: ['instructor', 'university_admin'] },
        status: 'active'
      });
      const activeInstitution = await Institution.exists({
        _id: targetInstitutionId,
        status: 'active'
      });
      if (!membership || !activeInstitution) {
        return res.status(403).json({
          error:
            'Forbidden: only active instructors and administrators can create institutional courses'
        });
      }
      courseScope = 'institutional';
    }

    // Verify subject exists and belongs to user
    const subject = await Subject.findOne({ _id: subject_id, userId });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Create course record directly (no AI processing)
    const course = new Course({
      title,
      description: description || '',
      subjectId: subject_id,
      userId,
      ownerUserId: userId,
      scope: courseScope,
      institutionId: courseScope === 'institutional' ? targetInstitutionId : undefined,
      assignedInstructorIds: courseScope === 'institutional' ? [userId] : [],
      status: 'completed',
      topics: (topics || []).map((t: ICourseTopic) => ({
        title: t.title,
        subtopics: (t.subtopics || []).map((sub: ISubtopic) => ({
          id: sub.id || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: sub.title,
          summary: sub.summary || '',
          key_concepts: sub.key_concepts || [],
          definitions: sub.definitions || [],
          formulas: sub.formulas || [],
          examples: sub.examples || [],
          tokenized_chunks: []
        }))
      })),
      files: [],
      processedAt: new Date()
    });

    await course.save();

    // Auto-award XP
    try {
      const USER_PROFILE_URL = 'module://users';
      await moduleClient.post(
        `${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`,
        {
          action: 'course_upload',
          metadata: { courseId: course._id.toString(), title: course.title, manual: true }
        },
        {
          headers: buildInternalHeaders(req.headers.cookie)
        }
      );
    } catch (xpErr) {
      console.warn('XP award failed for manual course:', errorDetails(xpErr).message);
    }

    res.status(201).json({
      course: {
        id: course._id.toString(),
        title: course.title,
        description: course.description,
        scope: course.scope || 'personal',
        institutionId: course.institutionId ? course.institutionId.toString() : undefined,
        assignedInstructorIds: course.assignedInstructorIds || [],
        subjectId: course.subjectId,
        status: course.status,
        topicsCount: course.topics?.length || 0,
        filesCount: 0,
        processedAt: course.processedAt,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt
      }
    });
  } catch (error) {
    console.error('Error creating manual course:', error);
    res.status(500).json({ error: 'Failed to create manual course' });
  }
});

// Assign instructor to course
router.post('/:courseId/instructors', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');
    const { instructorUserId } = req.body || {};

    const result = await assignInstructorToCourse(actorUserId, courseId, instructorUserId);
    res.status(200).json(result);
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

// Revoke instructor assignment
router.delete(
  '/:courseId/instructors/:instructorUserId',
  async (req: DomainRequest, res: Response) => {
    try {
      const actorUserId = req.user!.userId;
      const courseId = param(req, 'courseId');
      const instructorUserId = param(req, 'instructorUserId');

      const result = await revokeInstructorAssignment(actorUserId, courseId, instructorUserId);
      res.status(200).json(result);
    } catch (error) {
      handleEnrollmentError(res, error);
    }
  }
);

// Issue course invitation
router.post('/:courseId/invitations', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');
    const { role, expiresInHours, email } = req.body || {};
    if (email !== undefined && (role === 'instructor' || typeof email !== 'string' ||
      email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email))) {
      return res.status(400).json({ error: 'Enter one valid student email address' });
    }
    const recipientEmail = typeof email === 'string' ? email.toLowerCase() : undefined;
    const result = await issueCourseInvitation(actorUserId, courseId, { role, expiresInHours, recipientEmail });
    let emailSent = false;
    if (recipientEmail) {
      try {
        const course = await Course.findById(result.courseId).select('title').lean();
        await sendCourseInvitationEmail(recipientEmail, course?.title || 'your course', result.token);
        emailSent = true;
      } catch {
        // Return the same invitation so the instructor can share it manually.
      }
    }
    res.status(201).json({ ...result, emailSent });
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

// Accept course invitation (claim single-use token)
router.post('/invitations/accept', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { token, invitationId } = req.body || {};
    const result = invitationId === undefined
      ? await acceptCourseInvitation(userId, token, req.user?.email)
      : await acceptAddressedCourseInvitation(userId, req.user?.email, invitationId);
    res.status(200).json(result);
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

// Direct administrative or instructor enrollment
router.post('/:courseId/enrollments', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');
    const { studentUserId } = req.body || {};

    const result = await enrollStudentDirectly(actorUserId, courseId, studentUserId);
    res.status(201).json(result);
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

// List enrolled students in a course
router.get('/:courseId/enrollments', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');

    const enrollments = await listCourseEnrollments(actorUserId, courseId);
    res.status(200).json({ enrollments });
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

// Withdraw from course (self)
router.delete('/:courseId/enrollments', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');

    const result = await withdrawOrRevokeEnrollment(actorUserId, courseId, undefined);
    res.status(200).json(result);
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

// Revoke a student enrollment (instructor/admin)
router.delete(
  '/:courseId/enrollments/:studentUserId',
  async (req: DomainRequest, res: Response) => {
    try {
      const actorUserId = req.user!.userId;
      const courseId = param(req, 'courseId');
      const studentUserId = param(req, 'studentUserId');

      const result = await withdrawOrRevokeEnrollment(actorUserId, courseId, studentUserId);
      res.status(200).json(result);
    } catch (error) {
      handleEnrollmentError(res, error);
    }
  }
);

export default router;
module.exports = router;
