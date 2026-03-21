import React, { useState } from "react";

const TestGemini = () => {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const testAPI = async () => {
    setLoading(true);
    setError("");
    setResult("");

    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    if (!apiKey) {
      setError("API Key is missing. Please check your .env file.");
      setLoading(false);
      return;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: "Say 'Hello, Gemini API is working!' in JSON format: {\"message\": \"Hello, Gemini API is working!\"}" }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            message: { type: "STRING" }
          },
          required: ["message"]
        }
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (jsonString) {
        const parsed = JSON.parse(jsonString);
        setResult(`Success: ${parsed.message}`);
      } else {
        setError("No response content from API.");
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Test Gemini API Key</h2>
      <button onClick={testAPI} disabled={loading} style={{ padding: "10px 20px", marginBottom: "10px" }}>
        {loading ? "Testing..." : "Test API Key"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {result && <p style={{ color: "green" }}>{result}</p>}
    </div>
  );
};

export default TestGemini;
