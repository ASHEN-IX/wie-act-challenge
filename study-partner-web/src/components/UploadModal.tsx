import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, Check, AlertCircle } from "lucide-react";
import { courseAPI } from "../services/api";
import "./UploadModal.css";

const UploadModal = ({
  isOpen,
  onClose,
  onUploadComplete,
  subjectId,
  subjectName,
}: any) => {
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form on close
      setCourseTitle("");
      setCourseDescription("");
      setFiles([]);
      setError(null);
    }
  }, [isOpen]);

  const handleDrag = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file: any) => file.type === "application/pdf",
      );
      setFiles((prev: any) => [...prev, ...droppedFiles]);
    }
  };

  const handleFileChange = (e: any) => {
    if (e.target.files) {
      setFiles((prev: any) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: any) => {
    setFiles((prev: any) => prev.filter((_: any, i: any) => i !== index));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!courseTitle || files.length === 0) {
      setError("Please provide course title and upload at least one PDF.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("title", courseTitle);
      formData.append("description", courseDescription);
      formData.append("subject_id", subjectId);

      files.forEach((file) => {
        formData.append("files", file);
      });

      await courseAPI.create(formData);
      onUploadComplete();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to upload course. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="modal-container"
        >
          <div className="modal-header">
            <h2>Add New Course</h2>
            <button onClick={onClose} className="close-btn">
              <X size={24} />
            </button>
          </div>

          <div className="modal-content">
            <div className="form-group">
              <label>Subject</label>
              <input
                type="text"
                value={subjectName}
                className="modal-input"
                disabled
                style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
              />
            </div>

            <div className="form-group">
              <label>Course Title *</label>
              <input
                type="text"
                placeholder="e.g., Map Reduce, Introduction to Hadoop"
                value={courseTitle}
                onChange={(e: any) => setCourseTitle(e.target.value)}
                className="modal-input"
                disabled={uploading}
                required
              />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <textarea
                placeholder="Brief description of the course..."
                value={courseDescription}
                onChange={(e: any) => setCourseDescription(e.target.value)}
                className="modal-input"
                disabled={uploading}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Course Materials (PDF)</label>
              <div
                className={`file-drop-zone ${dragActive ? "active" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} />
                <p>Drag & drop PDFs here or click to browse</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {files.length > 0 && (
              <div className="file-list">
                {files.map((file: any, index: any) => (
                  <div key={index} className="file-item">
                    <FileText size={16} />
                    <span className="file-name">{file.name}</span>
                    <button
                      onClick={(e: any) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="remove-file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="confirm-btn"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <div className="spinner-small"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Add to Library
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UploadModal;
