import {
  prepareRevisionSources,
  SourceIntegrityError,
  captureImmutableSources,
  verifyRevisionArtifact,
  verifyBlob
} from '../services/revisionSources';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction, RequestHandler } from 'express';
import type { FilterQuery } from 'mongoose';
import type { ICourse, ICourseTopic, ISubtopic } from '../models';
import { errorDetails } from '@study-partner/shared/errors';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@study-partner/shared/domainContracts');
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@study-partner/shared/moduleClient');
import {
  Course,
  Subject,
  Institution,
  InstitutionMembership,
  CourseRevision,
  CourseEnrollment
} from '../models';
import { canReadCourse, canManageCourse } from '../services/resourceAccess';
import {
  getCourseDraft,
  updateCourseDraft,
  DraftForbiddenError,
  DraftNotFoundError,
  StaleRevisionError,
  HierarchyValidationError
} from '../services/courseDraft';
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
  enrollStudentDirectly,
  listCourseEnrollments,
  withdrawOrRevokeEnrollment,
  listAccessibleCourses,
  EnrollmentError
} from '../services/enrollments';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tierGate } = require('@study-partner/shared/tierGate');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireMultipart } = require('@study-partner/shared/middleware');
import { deleteObjectivesForDocument } from '../services/objectives';
import {
  enqueueCourseIngestionOperation,
  cancelIngestionOperation,
  retryIngestionOperation,
  reconcileIngestionOperation,
  IngestionConflictError
} from '../services/ingestionControl';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildInternalHeaders } = require('@study-partner/shared/auth');

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
} = require('@study-partner/shared/uploadValidation');

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
        const { sniffMagicBytes } = require('@study-partner/shared/uploadValidation');
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
      if (!(await canReadCourse(req.user!.userId, String(req.params.courseId))))
        return res.status(404).json({ error: 'Source file not found' });
      const course = await Course.findOne({
        _id: req.params.courseId,
        userId: req.user!.userId
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
      if (!(await canReadCourse(req.user!.userId, String(req.params.courseId))))
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
        sourceManifest: await captureImmutableSources(course._id.toString(), course.files),
        vectorIndexRef: `faiss/${course._id.toString()}/${revisionTag}.faiss`
      });

      try {
        const { jobId } = await enqueueCourseIngestionOperation(
          {
            userId,
            courseId: course._id.toString(),
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
    const { expectedRevisionTag, topics, summary, isInstructorReviewed } = req.body;

    const result = await updateCourseDraft(userId, courseId, {
      expectedRevisionTag,
      topics,
      summary,
      isInstructorReviewed
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
        sourceManifest: await captureImmutableSources(course._id.toString(), course.files),
        vectorIndexRef: `faiss/${course._id.toString()}/${revisionTag}.faiss`
      });

      try {
        const { jobId } = await enqueueCourseIngestionOperation(
          {
            userId,
            courseId: course._id.toString(),
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
    const { role, expiresInHours } = req.body || {};

    const result = await issueCourseInvitation(actorUserId, courseId, { role, expiresInHours });
    res.status(201).json(result);
  } catch (error) {
    handleEnrollmentError(res, error);
  }
});

// Accept course invitation (claim single-use token)
router.post('/invitations/accept', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { token } = req.body || {};

    const result = await acceptCourseInvitation(userId, token);
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
