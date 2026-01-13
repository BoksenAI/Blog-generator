
import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { API_Base } from "../apiConfig";
import "./History.css";
import BlogDetails from "./BlogDetails";

const History = ({ session, onBack }) => {
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedBlogId, setSelectedBlogId] = useState(null);

    useEffect(() => {
        fetchHistory();
    }, [session]);

    const fetchHistory = async () => {
        try {
            const token = session?.access_token;
            if (!token) return;

            const response = await fetch(`${API_Base}/api/my-blogs`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch history");
            }

            const data = await response.json();
            setBlogs(data.blogs || []);
        } catch (err) {
            setError(err.message);
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

    const handleBlogClick = (blogId) => {
        setSelectedBlogId(blogId);
    };

    const handleBackToHistory = () => {
        setSelectedBlogId(null);
    };

    if (selectedBlogId) {
        return <BlogDetails blogId={selectedBlogId} onBack={handleBackToHistory} session={session} />;
    }

    return (
        <div className="history-container">
            <div className="history-header">
                <h2>My Generated Blogs</h2>
                <button onClick={onBack} className="back-btn">
                    Back to Generator
                </button>
            </div>

            {loading ? (
                <div className="loading">Loading history...</div>
            ) : error ? (
                <div className="error-message">{error}</div>
            ) : blogs.length === 0 ? (
                <div className="empty-state">
                    <p>No blogs generated yet.</p>
                    <button onClick={onBack} className="create-btn">Create your first blog</button>
                </div>
            ) : (
                <div className="blogs-grid">
                    {blogs.map((blog) => (
                        <div
                            key={blog.id}
                            className="blog-card"
                            onClick={() => handleBlogClick(blog.id)}
                        >
                            <div className="blog-card-header">
                                <h3>{blog.venue_name}</h3>
                                <span className={`status ${blog.status}`}>{blog.status}</span>
                            </div>
                            <div className="blog-meta">
                                <p><strong>Topic:</strong> {blog.draft_topic}</p>
                                <p><strong>Created:</strong> {formatDate(blog.created_at)}</p>
                                <p><strong>Month:</strong> {blog.target_month}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default History;
