
import { createClient } from "@supabase/supabase-js";

// We create a new client for each request context or use fetch for verification.
// Using a separate verification function is cleaner.

const getUser = async (token) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    // We need the ANON key to verify user tokens appropriately via the public endpoint, 
    // OR we can use the Service Role key but treat the token carefully.
    // Actually, sending a GET to /auth/v1/user with the Bearer token and the API Key is the standard way.
    // If we only have Service Role key on server, we can use it.

    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !apiKey) {
        console.error("Missing Supabase env vars in auth middleware");
        return null;
    }

    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: apiKey,
            },
        });

        if (!response.ok) {
            const err = await response.text();
            // console.warn("Auth token verification failed:", err);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Auth middleware error:", error);
        return null;
    }
};

export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        req.user = null;
        return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        req.user = null;
        return next();
    }

    const user = await getUser(token);
    req.user = user;

    // console.log("Middleware User:", user?.id);

    next();
};

export const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    next();
};
