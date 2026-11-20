
"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TestConnection() {
  const [message, setMessage] = useState("Not tested yet");
  const [loading, setLoading] = useState(false);

  async function testConnection() {
    setLoading(true);
    setMessage("Connecting to Supabase...");

    const { error } = await supabase
      .from("businesses")
      .select("*")
      .limit(1);

    if (error) {
      setMessage("Connection test returned: " + error.message);
    } else {
      setMessage("SUCCESS! SMARTBIZ is connected to Supabase.");
    }

    setLoading(false);
  }

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>SMARTBIZ Connection Test</h1>
      <p>Check whether SMARTBIZ can communicate with Supabase.</p>

      <button onClick={testConnection} disabled={loading}>
        {loading ? "Testing..." : "TEST CONNECTION"}
      </button>

      <p>{message}</p>
    </main>
  );
}
