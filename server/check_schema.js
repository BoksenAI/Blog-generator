
import dotenv from "dotenv";
dotenv.config({ path: "./server/.env" });

async function checkSchema() {
    const { supabase } = await import("./supabaseClient.js");

    const { data, error } = await supabase
        .from("venue-prompt")
        .select("id, website")
        .not("website", "is", null)
        .limit(1);

    if (error) {
        console.error("Error fetching venue-prompt:", error);
    } else if (data && data.length > 0) {
        console.log("Sample venue with website:", data[0]);
    } else {
        console.log("No data found in venue-prompt table with a website.");
    }
}

checkSchema();
