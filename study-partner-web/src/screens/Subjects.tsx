'use client';
import React, { useState, useEffect } from "react";
import { useNavigate } from "@/navigation";
import { subjectAPI } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { BookOpen, Plus, Search } from "lucide-react";
import { useCallback } from "react";
import CreateSubjectModal from "../components/CreateSubjectModal";
import "./Subjects.css";

const Subjects = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadSubjects = useCallback(async () => {
    if (!user?._id) return;
    if (!user?._id) return;
    try {
      const response = await subjectAPI.list();
      setSubjects(response.data.subjects || []);
    } catch (error: any) {
      console.error("Failed to load subjects:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadSubjects();
  }, [user, loadSubjects]);

  const handleSubjectClick = (subjectId: any) => {
    navigate(`/subjects/${subjectId}`);
  };

  const filteredSubjects = subjects.filter((subject) =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const resolveImageUrl = (url: any) => {
    if (!url) return null;
    // If the URL is an embedded data URL, return it directly
    if (url.startsWith("data:")) return url;
    if (url.startsWith("http")) return url;
    // If the backend returned a plain /uploads/... path (study service stores uploads locally),
    // request it directly from the study service host because the API gateway proxies /uploads
    // to the user-profile service by default.
    if (url.startsWith("/uploads")) {
      const studyBase = process.env.NEXT_PUBLIC_API_URL || "";
      return `${studyBase.replace(/\/$/, "")}${url}`;
    }

    const base = process.env.NEXT_PUBLIC_API_URL || "";
    // If VITE_API_URL is set, prefix with it; otherwise return a relative path so Vite proxy handles it
    if (!base) {
      return url.startsWith("/") ? url : `/${url}`;
    }
    return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
  };

  return (
    <div className="subjects-container">
      <div className="subjects-header">
        <div className="header-left">
          <div className="title-section">
            <h1>Library</h1>
            <span className="count-badge">{subjects.length}</span>
          </div>
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search subjects..."
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button
          className="add-fab"
          onClick={() => setIsModalOpen(true)}
          title="Add Subject"
        >
          <Plus size={24} />
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your library...</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={64} />
          <h2>Your Library is Empty</h2>
          <p>
            Create your first subject to organize your courses and study
            materials.
          </p>
          <button className="cta-btn" onClick={() => setIsModalOpen(true)}>
            <Plus size={20} />
            Create First Subject
          </button>
        </div>
      ) : (
        <div className="subjects-grid">
          {filteredSubjects.map((subject) => (
            <div
              key={subject.id}
              className="subject-card"
              onClick={() => handleSubjectClick(subject.id)}
            >
              <div className="card-image-wrapper">
                {subject.image ? (
                  <img
                    src={resolveImageUrl(subject.image)}
                    alt={subject.name}
                    className="subject-cover-image"
                    loading="lazy"
                    onError={(e: any) => {
                      console.error("Subject image load failed:", e.target.src);
                      e.target.style.opacity = "0";
                    }}
                  />
                ) : (
                  <div className="subject-placeholder-gradient">
                    <BookOpen size={48} />
                  </div>
                )}
                <div className="card-overlay"></div>
              </div>

              <div className="card-content">
                <span className="subject-type">SUBJECT</span>
                <h3 className="subject-title">{subject.name}</h3>
                <div className="subject-details">
                  <span className="course-count">
                    {subject.course_count}{" "}
                    {subject.course_count === 1 ? "Course" : "Courses"}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Add New Card in Grid */}
          <div
            className="subject-card add-card"
            onClick={() => setIsModalOpen(true)}
          >
            <div className="card-image-wrapper plain">
              <Plus size={48} className="add-icon" />
            </div>
            <div className="card-content">
              <span className="subject-type">ACTION</span>
              <h3 className="subject-title">Add Subject</h3>
            </div>
          </div>
        </div>
      )}

      <CreateSubjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubjectCreated={loadSubjects}
      />
    </div>
  );
};

export default Subjects;
