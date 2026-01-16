import React, { useState, useEffect } from "react";
import "./App.css";
import { supabase } from "./supabase";
import { marked } from "marked";
import { API_Base } from "./apiConfig";
import Header from "./components/Header";
import Login from "./components/Login";
import History from "./components/History";
import AuthGateModal from "./components/AuthGateModal";
import ResetPassword from "./components/ResetPassword";

function App() {
  const [formData, setFormData] = useState({
    venueName: "",
    targetMonth: "",
    weekOfMonth: "",
    creator: "",
    draftTopic: "",
    specialInstructions: "",
    heroImageFile: null,
    galleryImageFiles: [],
  });

  const [blogContent, setBlogContent] = useState("");
  const [images, setImages] = useState([]);
  const [blogId, setBlogId] = useState(null);
  const [refreshingSection, setRefreshingSection] = useState(null);
  const [customQueries, setCustomQueries] = useState({}); // { sectionName: "query string" }

  // Auth & View State
  const [session, setSession] = useState(null);

  // Auth gate modal (shown when user tries to Generate / Download while logged out)
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateReason, setAuthGateReason] = useState("generate"); // "generate" | "download"
  const [pendingAction, setPendingAction] = useState(null); // function to run after “Continue as guest”

  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState("login");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleHeroImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    setFormData((prev) => ({
      ...prev,
      heroImageFile: file || null,
    }));
  };

  const handleGalleryImagesChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setFormData((prev) => ({
        ...prev,
        // Append new files
        galleryImageFiles: [...prev.galleryImageFiles, ...newFiles],
      }));
    }
  };

  const removeGalleryImage = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      galleryImageFiles: prev.galleryImageFiles.filter(
        (_, index) => index !== indexToRemove
      ),
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const actuallyGenerateBlog = async () => {
    try {
      setLoading(true);
      setError("");
      setBlogContent("");
      setImages([]);

      const headers = {
        // Don't set Content-Type for FormData (browser sets it automatically)
      };

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const body = new FormData();
      body.append("venueName", formData.venueName);
      body.append("targetMonth", formData.targetMonth);
      body.append("weekOfMonth", formData.weekOfMonth);
      body.append("creator", formData.creator);
      body.append("draftTopic", formData.draftTopic);
      body.append("specialInstructions", formData.specialInstructions);

      if (formData.heroImageFile) {
        body.append("heroImage", formData.heroImageFile);
      }

      formData.galleryImageFiles.forEach((file) => {
        body.append("galleryImages", file);
      });

      const response = await fetch(`${API_Base}/api/generate-blog`, {
        method: "POST",
        headers,
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate blog");
      }

      setBlogContent(data.blogContent);
      setImages(data.images || []);
      setBlogId(data.blogId);
    } catch (err) {
      setError(err.message || "An error occurred while generating the blog");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // If user is not logged in, show auth gate modal first
    if (!session) {
      setAuthGateReason("generate");
      setPendingAction(() => () => {
        actuallyGenerateBlog();
      });
      setShowAuthGate(true);
      return;
    }

    // Logged-in users generate normally
    await actuallyGenerateBlog();
  };

  const handleCustomQueryChange = (section, value) => {
    setCustomQueries((prev) => ({
      ...prev,
      [section]: value,
    }));
  };
  /*const showUserUploads = () => {
    for (let i = 0; i < imageFileNames.length; i++) {
        console.log(imageFileNames[i]);
    }

  };*/
  async function refreshImage(section) {
    if (!blogId) {
      setError("No blogId found yet. Generate a blog first.");
      return;
    }

    try {
      setRefreshingSection(section);
      setError("");

      const customQuery = customQueries[section]; // Get input value if exists

      const headers = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const resp = await fetch(`${API_Base}/api/refresh-image`, {
        method: "POST",
        headers,
        body: JSON.stringify({ blogId, section, customQuery }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to refresh image");

      setImages(data.images || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshingSection(null);
    }
  }

  const downloadDraft = () => {
    // If user is not logged in, show gate modal first
    if (!session) {
      setAuthGateReason("download");
      setPendingAction(() => () => {
        downloadDraft();
      });
      setShowAuthGate(true);
      return;
    }

    if (!blogContent) {
      alert("No blog content to download. Please generate a blog first.");
      return;
    }

    const metadata = `
Venue Name: ${formData.venueName}
Target Month: ${formData.targetMonth}
Week of Month: ${formData.weekOfMonth}
Creator: ${formData.creator}
Draft Topic / Title: ${formData.draftTopic}
Generated: ${new Date().toLocaleString()}

---

  `;

    const content = metadata + blogContent;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formData.venueName.replace(/\s+/g, "_")} _Draft.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadHtml = () => {
    // If user is not logged in, show gate modal first
    if (!session) {
      setAuthGateReason("download");
      setPendingAction(() => () => {
        downloadHtml();
      });
      setShowAuthGate(true);
      return;
    }

    if (!blogContent) {
      alert("No blog content to download. Please generate a blog first.");
      return;
    }

    // Build HTML Content
    const contentHtml = marked.parse(blogContent);

    let htmlContent = `< !DOCTYPE html >
  <html lang="en">
    <head>
      <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${formData.venueName} - Blog Draft</title>
          <style>
            body {font - family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
            h1 {color: #222; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            h2 {margin - top: 30px; color: #444; }
            a {color: #007bff; text-decoration: none; }
            a:hover {text - decoration: underline; }
            strong {color: #000; }
            .metadata {background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-size: 0.9em; color: #666; }
            .content {margin - bottom: 40px; }
            .images-section {border - top: 2px solid #eee; padding-top: 20px; margin-top: 40px; }
            .image-card {border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
            img {max - width: 100%; height: auto; border-radius: 4px; display: block; margin-bottom: 10px; }
            .img-meta {font - size: 0.9em; color: #555; }
            .img-meta strong {color: #333; }
          </style>
        </head>
        <body>
          <h1>${formData.venueName} - Blog Draft</h1>

          <div class="metadata">
            <p><strong>Target Month:</strong> ${formData.targetMonth}</p>
            <p><strong>Week of Month:</strong> ${formData.weekOfMonth}</p>
            <p><strong>Creator:</strong> ${formData.creator}</p>
            <p><strong>Draft Topic:</strong> ${formData.draftTopic}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div class="content">${contentHtml}</div>

          <div class="images-section">
            <h2>Generated Images + Metadata</h2>
            ${images
              .map(
                (img) => `
        <div class="image-card">
            ${
              img.image_url
                ? `<img src="${img.image_url}" alt="${img.alt_text || ""}">`
                : "<p><em>No image source available</em></p>"
            }
            <div class="img-meta">
                <div><strong>File Name:</strong> ${img.file_name}</div>
                <div><strong>Title Tag:</strong> ${img.title_tag || "N/A"}</div>
                <div><strong>Alt Text:</strong> ${img.alt_text || "N/A"}</div>
            </div>
        </div>
        `
              )
              .join("")}
          </div>
        </body>
      </html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formData.venueName.replace(/\s+/g, "_")}_Draft.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isResetPage = window.location.pathname === "/reset-password";

  if (isResetPage) {
    return <ResetPassword />;
  }

  return (
    <div className="app">
      <Header
        session={session}
        onLoginClick={() => {
          setLoginMode("login");
          setShowLogin(true);
        }}
        onSignUpClick={() => {
          setLoginMode("signup");
          setShowLogin(true);
        }}
        onLogout={() => supabase.auth.signOut()}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
      />

      <AuthGateModal
        isOpen={showAuthGate}
        reason={authGateReason}
        onClose={() => setShowAuthGate(false)}
        onSignIn={() => {
          setShowAuthGate(false);
          setLoginMode("login");
          setShowLogin(true);
        }}
        onSignUp={() => {
          setShowAuthGate(false);
          setLoginMode("signup");
          setShowLogin(true);
        }}
        onContinueAsGuest={() => {
          setShowAuthGate(false);
          if (pendingAction) pendingAction();
        }}
      />

      {showLogin && (
        <Login initialMode={loginMode} onClose={() => setShowLogin(false)} />
      )}

      <div className="container">
        {showHistory && session ? (
          <History session={session} onBack={() => setShowHistory(false)} />
        ) : (
          <>
            <h1 className="title">Blog Generator</h1>
            <p className="subtitle">
              Generate professional blog posts using AI
            </p>

            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="venueName">Venue Name *</label>
                <input
                  type="text"
                  id="venueName"
                  name="venueName"
                  value={formData.venueName}
                  onChange={handleChange}
                  required
                  placeholder="Enter venue name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="targetMonth">Target Month *</label>
                <input
                  type="text"
                  id="targetMonth"
                  name="targetMonth"
                  value={formData.targetMonth}
                  onChange={handleChange}
                  required
                  placeholder="e.g., January 2024"
                />
              </div>

              <div className="form-group">
                <label htmlFor="weekOfMonth">Week of Month *</label>
                <select
                  id="weekOfMonth"
                  name="weekOfMonth"
                  value={formData.weekOfMonth}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select week</option>
                  <option value="First Week">First Week</option>
                  <option value="Second Week">Second Week</option>
                  <option value="Third Week">Third Week</option>
                  <option value="Fourth Week">Fourth Week</option>
                  <option value="Last Week">Last Week</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="creator">Creator *</label>
                <input
                  type="text"
                  id="creator"
                  name="creator"
                  value={formData.creator}
                  onChange={handleChange}
                  required
                  placeholder="Enter creator name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="draftTopic">Draft Topic/Title *</label>
                <input
                  type="text"
                  id="draftTopic"
                  name="draftTopic"
                  value={formData.draftTopic}
                  onChange={handleChange}
                  required
                  placeholder="Enter blog topic or title"
                />
              </div>

              <div className="form-group">
                <label htmlFor="specialInstructions">
                  Special Instructions
                </label>
                <textarea
                  id="specialInstructions"
                  name="specialInstructions"
                  value={formData.specialInstructions}
                  onChange={handleChange}
                  placeholder="Any special instructions or requirements for the blog..."
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label htmlFor="heroImage">Hero Image (optional)</label>
                <div className="image-dropbox">
                  <input
                    id="heroImage"
                    type="file"
                    accept="image/*"
                    onChange={handleHeroImageChange}
                  />
                  <p className="image-dropbox-help">
                    Select a single Hero Image to appear at the top.
                  </p>
                  {formData.heroImageFile && (
                    <p className="image-selected">
                      Selected: <strong>{formData.heroImageFile.name}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="galleryImages">
                  Gallery / Section Images (optional)
                </label>
                <div className="image-dropbox">
                  <input
                    id="galleryImages"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryImagesChange}
                  />
                  <p className="image-dropbox-help">
                    Drag and drop multiple images for the blog body.
                  </p>
                  {formData.galleryImageFiles.length > 0 && (
                    <div className="image-selected-list">
                      <p>Selected Gallery Images:</p>
                      <ul>
                        {formData.galleryImageFiles.map((file, idx) => (
                          <li key={idx} className="file-list-item">
                            {file.name}
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => removeGalleryImage(idx)}
                              title="Remove image"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <small className="helper-text">
                  The file names will be sent to the AI to generate metadata.
                </small>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Generating..." : "Generate Blog"}
              </button>
            </form>

            {error && <div className="error-message">{error}</div>}

            {blogContent && (
              <div className="blog-preview">
                <div className="blog-header">
                  <h2>Generated Blog</h2>
                  <button onClick={downloadDraft} className="download-btn">
                    Download Draft (MD)
                  </button>
                  <button
                    onClick={downloadHtml}
                    className="download-btn"
                    style={{ marginLeft: "10px", background: "#007bff" }}
                  >
                    Download HTML
                  </button>
                </div>
                <div
                  className="blog-content"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(blogContent),
                  }}
                />
                {images.length > 0 && (
                  <div className="image-preview">
                    <h3>Generated Images + Metadata</h3>

                    {images.map((img) => (
                      <div
                        key={img.image_url + img.section}
                        className="image-card"
                      >
                        {img.image_source === "user_placeholder" ? (
                          <div className="user-image-placeholder">
                            <div className="placeholder-icon">📷</div>
                            <span>
                              User Image: <strong>{img.file_name}</strong>
                            </span>
                            <small>
                              (Not uploaded, metadata generated only)
                            </small>
                          </div>
                        ) : (
                          <img
                            src={img.image_url}
                            alt={img.alt_text || ""}
                            className="image"
                          />
                        )}

                        <div className="image-meta">
                          <div>
                            <strong>File name:</strong> {img.file_name}
                          </div>
                          <div>
                            <strong>Title tag:</strong> {img.title_tag}
                          </div>
                          <div>
                            <strong>Alt text:</strong> {img.alt_text}
                          </div>
                        </div>
                        <div className="refresh-container">
                          <input
                            type="text"
                            placeholder="Custom search query (optional)"
                            className="custom-query-input"
                            value={customQueries[img.section] || ""}
                            onChange={(e) =>
                              handleCustomQueryChange(
                                img.section,
                                e.target.value
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() => refreshImage(img.section)}
                            disabled={refreshingSection === img.section}
                            className="refresh-btn"
                          >
                            {refreshingSection === img.section
                              ? "Refreshing..."
                              : "Refresh image"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
