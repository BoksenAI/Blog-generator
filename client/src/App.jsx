import React, { useState } from "react";
import "./App.css";

function App() {
  const [formData, setFormData] = useState({
    venueName: "",
    targetMonth: "",
    weekOfMonth: "",
    creator: "",
    draftTopic: "",
    specialInstructions: "",
    imageFileName: "",
  });

  const [blogContent, setBlogContent] = useState("");
  const [images, setImages] = useState([]);
  const [blogId, setBlogId] = useState(null);
  const [refreshingSection, setRefreshingSection] = useState(null);
  const [customQueries, setCustomQueries] = useState({}); // { sectionName: "query string" }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    setFormData((prev) => ({
      ...prev,
      imageFileName: file ? file.name : "",
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setBlogContent("");
    setImages([]); // clear old images when generating again

    try {
      // Use VITE_API_URL from environment variables, or default to relative path (for proxy)
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${apiUrl}/api/generate-blog`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate blog");
      }

      setBlogContent(data.blogContent);
      setImages(data.images || []); // <-- save images + metadata returned from backend
      setBlogId(data.blogId);
    } catch (err) {
      setError(err.message || "An error occurred while generating the blog");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomQueryChange = (section, value) => {
    setCustomQueries((prev) => ({
      ...prev,
      [section]: value,
    }));
  };

  async function refreshImage(section) {
    if (!blogId) {
      setError("No blogId found yet. Generate a blog first.");
      return;
    }

    try {
      setRefreshingSection(section);
      setError("");

      const customQuery = customQueries[section]; // Get input value if exists

      const resp = await fetch("http://localhost:3001/api/refresh-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    if (!blogContent) {
      alert("No blog content to download. Please generate a blog first.");
      return;
    }

    const metadata = `
Venue Name: ${formData.venueName}
Target Month: ${formData.targetMonth}
Week of Month: ${formData.weekOfMonth}
Creator: ${formData.creator}
Draft Topic/Title: ${formData.draftTopic}
Generated: ${new Date().toLocaleString()}

---

`;

    const content = metadata + blogContent;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">Blog Generator</h1>
        <p className="subtitle">Generate professional blog posts using AI</p>

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
            <label htmlFor="specialInstructions">Special Instructions</label>
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
            <label htmlFor="imageFile">Image (optional)</label>
            <div className="image-dropbox">
              <input
                id="imageFile"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              <p className="image-dropbox-help">
                Drag and drop an image file here, or click to choose a file.
              </p>
              {formData.imageFileName && (
                <p className="image-selected">
                  Selected: <strong>{formData.imageFileName}</strong>
                </p>
              )}
            </div>
            <small className="helper-text">
              The file name will be sent to the AI to generate image metadata
              (file name, title tag, alt text) and appended to the end of the
              blog draft.
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
                Download Draft
              </button>
            </div>
            <div className="blog-content">{blogContent}</div>
            {images.length > 0 && (
              <div className="image-preview">
                <h3>Generated Images + Metadata</h3>

                {images.map((img) => (
                  <div key={img.image_url} className="image-card">
                    <img
                      src={img.image_url}
                      alt={img.alt_text || ""}
                      className="image"
                    />

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
                          handleCustomQueryChange(img.section, e.target.value)
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
      </div>
    </div>
  );
}

export default App;
