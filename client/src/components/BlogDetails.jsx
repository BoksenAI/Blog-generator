import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import "./BlogDetails.css";

const BlogDetails = ({ blogId, onBack }) => {
    const [blog, setBlog] = useState(null);
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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
                <h2>Blog Details</h2>
                <button onClick={onBack} className="back-btn">
                    Back to History
                </button>
            </div>

            <div className="blog-details-content">
                <div className="blog-info-section">
                    <div className="info-row">
                        <strong>Venue Name:</strong> {blog.venue_name}
                    </div>
                    <div className="info-row">
                        <strong>Draft Topic/Title:</strong> {blog.draft_topic}
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
                        <div className="blog-content">{blog.blog_content}</div>
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
                                    {img.image_url && (
                                        <img
                                            src={img.image_url}
                                            alt={img.alt_text || ""}
                                            className="detail-image"
                                        />
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
