import { errorDetails } from '@ednova/shared/errors';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
import multer from 'multer';
import path from 'path';
import { Subject, Course } from '../models';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@ednova/shared/moduleClient');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildInternalHeaders } = require('@ednova/shared/auth');

const router = createContracts();

const IMAGE_ALLOW_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const allowedExts = IMAGE_ALLOW_TYPES[file.mimetype];
    const err = new Error('Only JPEG, PNG, GIF, or WebP images are allowed');
    if (!allowedExts || !allowedExts.includes(ext)) return cb(err);
    cb(null, true);
  }
});

// Get all subjects for a user
router.get('/', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const subjects = await Subject.find({ userId }).sort({ createdAt: -1 });

    const subjectsWithCount = await Promise.all(
      subjects.map(async (subject) => {
        const courseCount = await Course.countDocuments({
          subjectId: subject.id.toString(),
          userId
        });
        return {
          id: subject.id.toString(),
          name: subject.name,
          description: subject.description,
          image: subject.image,
          color: subject.color,
          course_count: courseCount,
          createdAt: subject.createdAt,
          updatedAt: subject.updatedAt
        };
      })
    );

    res.json({ subjects: subjectsWithCount });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create a new subject
router.post('/', upload.single('image'), async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const existingSubject = await Subject.findOne({ name, userId });
    if (existingSubject) {
      return res.status(400).json({ error: 'Subject with this name already exists' });
    }

    let imageUrl = null;
    if (req.file && req.file.buffer) {
      const mime = req.file.mimetype || 'application/octet-stream';
      const b64 = req.file.buffer.toString('base64');
      imageUrl = `data:${mime};base64,${b64}`;
    }

    const subject = await Subject.create({
      name,
      description,
      userId,
      image: imageUrl
    });

    try {
      const USER_PROFILE_URL = 'module://users';
      const payload = {
        action: 'subject_create',
        metadata: { subjectId: subject.id.toString(), name: subject.name }
      };
      await moduleClient.post(`${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`, payload, {
        headers: buildInternalHeaders(req.headers.cookie)
      });
    } catch (xpErr) {
      const respData = errorDetails(xpErr).data ?? null;
      console.warn(
        'XP award failed for subject creation:',
        xpErr && (xpErr instanceof Error ? xpErr.message : String(xpErr)),
        'responseData:',
        respData
      );
    }

    res.status(201).json({
      subject: {
        id: subject.id.toString(),
        name: subject.name,
        description: subject.description,
        image: subject.image,
        color: subject.color,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt
      }
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Get a specific subject
router.get('/:subjectId', async (req: DomainRequest, res: Response) => {
  try {
    const { subjectId } = req.params;
    const userId = req.user!.userId;

    const subject = await Subject.findOne({ id: subjectId, userId });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const courseCount = await Course.countDocuments({
      subjectId: subjectId,
      userId
    });

    res.json({
      subject: {
        id: subject.id.toString(),
        name: subject.name,
        description: subject.description,
        image: subject.image,
        color: subject.color,
        course_count: courseCount,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// Update a subject
router.put('/:subjectId', upload.single('image'), async (req: DomainRequest, res: Response) => {
  try {
    const { subjectId } = req.params;
    const { name, description } = req.body;
    const userId = req.user!.userId;

    const subject = await Subject.findOne({ id: subjectId, userId });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (name) subject.name = name;
    if (description !== undefined) subject.description = description;

    if (req.file && req.file.buffer) {
      const mime = req.file.mimetype || 'application/octet-stream';
      const b64 = req.file.buffer.toString('base64');
      subject.image = `data:${mime};base64,${b64}`;
    }

    await Subject.save(subject);

    res.json({
      subject: {
        id: subject.id.toString(),
        name: subject.name,
        description: subject.description,
        image: subject.image,
        color: subject.color,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Delete a subject
router.delete('/:subjectId', async (req: DomainRequest, res: Response) => {
  try {
    const { subjectId } = req.params;
    const userId = req.user!.userId;

    const subject = await Subject.findOneAndDelete({ id: subjectId, userId });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    await Course.deleteMany({ subjectId: subjectId, userId });

    res.json({ message: 'Subject and associated courses deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

export default router;
module.exports = router;
