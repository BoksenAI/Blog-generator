import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { API_Base } from "../apiConfig";
import "./BlogDetails.css";

const BlogDetails = ({ blogId, onBack, session }) => {
    const [blog, setBlog] = useState(null);
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        venue_name: "",
        draft_topic: "",
        blog_content: ""
    });

    useEffect(() => {
        if (blog) {
            setEditForm({
                venue_name: blog.venue_name || "",
                draft_topic: blog.draft_topic || "",
                blog_content: blog.blog_content || ""
            });
        }
    }, [blog]);

    useEffect(() => {
        fetchBlogDetails();
    }, [blogId]);

    const fetchBlogDetails = async () => {
        try {
            setLoading(true);
            setError("");

            const [blogResponse, imagesResponse] = await Promise.all([
                supabase.from("blogs").select("*").eq("id", blogId).single(),
                supabase
                    .from("blog_images")
                    .select("*")
                    .eq("blog_id", blogId)
                    .order("created_at", { ascending: false }),
            ]);

            if (blogResponse.error) throw blogResponse.error;
            if (imagesResponse.error) throw imagesResponse.error;

            setBlog(blogResponse.data);
            setImages(imagesResponse.data || []);
        } catch (err) {
            setError(err.message || "Failed to fetch blog details");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const sortImagesBySection = (images) => {
        const sectionOrder = ["hero", "gallery_1", "gallery_2", "gallery_3", "gallery_4", "gallery_5"];
        return [...images].sort((a, b) => {
            const aIndex = sectionOrder.indexOf(a.section || "");
            const bIndex = sectionOrder.indexOf(b.section || "");
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this blog? This cannot be undone.")) return;

        try {
            const response = await fetch(`http://localhost:3001/api/blogs/${blogId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${onBack.name ? "" : session?.access_token}`, // onBack hack invalid, use session
                }
            });

            // The session generic prop might be missing in some legacy calls if not careful, 
            // but we added it.
            // Better to use session directly.
        } catch (e) { }
    };

    // Correct implementation of actions
    const performDelete = async () => {
        if (!confirm("Delete this blog permanently?")) return;
        try {
            const res = await fetch(`${API_Base}/api/blogs/${blogId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                    "Content-Type": "application/json"
                }
            });
            if (!res.ok) throw new Error("Failed to delete");
            onBack(); // Return to list
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSave = async () => {
        try {
            const res = await fetch(`${API_Base}/api/blogs/${blogId}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${session?.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(editForm)
            });

            if (!res.ok) throw new Error("Failed to update");

            setBlog({ ...blog, ...editForm });
            setIsEditing(false);
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) {
        return (
            <div className="blog-details-container">
                <div className="loading">Loading blog details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="blog-details-container">
                <div className="error-message">{error}</div>
                <button onClick={onBack} className="back-btn">
                    Back to History
                </button>
            </div>
        );
    }

    if (!blog) {
        return (
            <div className="blog-details-container">
                <div className="error-message">Blog not found</div>
                <button onClick={onBack} className="back-btn">
                    Back to History
                </button>
            </div>
        );
    }

    const sortedImages = sortImagesBySection(images);

    return (
        <div className="blog-details-container">
            <div className="blog-details-header">
                <h2>{isEditing ? "Edit Blog" : "Blog Details"}</h2>
                <div className="header-actions">
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="save-btn">Save</button>
                            <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className="edit-btn">Edit</button>
                            <button onClick={performDelete} className="delete-btn">Delete</button>
                            <button onClick={onBack} className="back-btn">Back</button>
                        </>
                    )}
                </div>
            </div>

            <div className="blog-details-content">
                <div className="blog-info-section">
                    <div className="info-row">
                        <strong>Venue Name:</strong>{" "}
                        {isEditing ? (
                            <input
                                value={editForm.venue_name}
                                onChange={e => setEditForm({ ...editForm, venue_name: e.target.value })}
                                className="edit-input"
                            />
                        ) : blog.venue_name}
                    </div>
                    <div className="info-row">
                        <strong>Draft Topic/Title:</strong>{" "}
                        {isEditing ? (
                            <input
                                value={editForm.draft_topic}
                                onChange={e => setEditForm({ ...editForm, draft_topic: e.target.value })}
                                className="edit-input"
                            />
                        ) : blog.draft_topic}
                    </div>
                    <div className="info-row">
                        <strong>Created Date:</strong> {formatDate(blog.created_at)}
                    </div>
                    {blog.status && (
                        <div className="info-row">
                            <strong>Status:</strong>{" "}
                            <span className={`status ${blog.status}`}>{blog.status}</span>
                        </div>
                    )}
                </div>

                {blog.blog_content && (
                    <div className="blog-content-section">
                        <h3>Blog Content</h3>
                        {isEditing ? (
                            <textarea
                                value={editForm.blog_content}
                                onChange={e => setEditForm({ ...editForm, blog_content: e.target.value })}
                                className="edit-textarea"
                                rows={20}
                            />
                        ) : (
                            <div className="blog-content">{blog.blog_content}</div>
                        )}
                    </div>
                )}

                {sortedImages.length > 0 && (
                    <div className="blog-images-section">
                        <h3>Associated Images</h3>
                        <div className="images-list">
                            {sortedImages.map((img, index) => (
                                <div key={img.id || index} className="image-detail-card">
                                    {img.section && (
                                        <div className="image-section-label">
                                            Section: {img.section}
                                        </div>
                                    )}
                                    {img.image_url && img.image_source !== "user_placeholder" ? (
                                        <img
                                            src={img.image_url}
                                            alt={img.alt_text || ""}
                                            className="detail-image"
                                        />
                                    ) : (
                                        <div className="detail-image-placeholder">
                                            <div className="placeholder-icon">📷</div>
                                            <span>User Image: <strong>{img.file_name}</strong></span>
                                            <div className="placeholder-note">(Metadata generated)</div>
                                        </div>
                                    )}
                                    <div className="image-meta-detail">
                                        {img.file_name && (
                                            <div>
                                                <strong>File name:</strong> {img.file_name}
                                            </div>
                                        )}
                                        {img.title_tag && (
                                            <div>
                                                <strong>Title tag:</strong> {img.title_tag}
                                            </div>
                                        )}
                                        {img.alt_text && (
                                            <div>
                                                <strong>Alt text:</strong> {img.alt_text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlogDetails;
