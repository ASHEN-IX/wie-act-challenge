import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Image as ImageIcon, Check, AlertCircle } from "lucide-react";
import { subjectAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import "./CreateSubjectModal.css";

const CreateSubjectModal = ({ isOpen, onClose, onSubjectCreated }: any) => {
  const user = useAuthStore((state) => state.user);
  const [subjectName, setSubjectName] = useState("");
  const [subjectImage, setSubjectImage] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<any>(null);

  const imageInputRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form on close
      setSubjectName("");
      setSubjectImage(null);
      setImagePreview(null);
      setError(null);
    }
  }, [isOpen]);

  const handleImageChange = (e: any) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSubjectImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!subjectName || !subjectImage) {
      setError("Please provide both subject name and cover image.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("name", subjectName);
      formData.append("user_id", user._id);
      formData.append("image", subjectImage);

      await subjectAPI.create(formData);
      onSubjectCreated();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to create subject. Please try again.",
      );
    } finally {
      setCreating(false);
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
            <h2>Create New Subject</h2>
            <button onClick={onClose} className="close-btn">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="modal-content">
            {error && (
              <div className="error-message">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label>Subject Name *</label>
              <input
                type="text"
                value={subjectName}
                onChange={(e: any) => setSubjectName(e.target.value)}
                placeholder="e.g., Big Data, Machine Learning"
                disabled={creating}
                required
              />
            </div>

            <div className="form-group">
              <label>Cover Image *</label>
              <div
                className="image-upload-area"
                onClick={() => imageInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Subject preview" />
                    <div className="image-overlay">
                      <ImageIcon size={24} />
                      <span>Click to change</span>
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <ImageIcon size={48} />
                    <span>Click to upload cover image</span>
                    <small>PNG, JPG up to 5MB</small>
                  </div>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={creating || !subjectName || !subjectImage}
              >
                {creating ? (
                  <>
                    <div className="spinner"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Create Subject
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateSubjectModal;
