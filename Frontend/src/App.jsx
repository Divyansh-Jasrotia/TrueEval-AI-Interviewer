import { useState } from "react";
import LandingPage from "./pages/LandingPage";
import InterviewPage from "./pages/InterviewPage";
import ReportPage from "./pages/ReportPage";
import "./index.css";

export default function App() {
  const [page, setPage] = useState("landing"); // landing | interview | report
  const [config, setConfig] = useState({
    jobRole: "Software Engineer",
    topic: "software engineering",
    totalQuestions: 5,
  });
  const [report, setReport] = useState(null);

  return (
    <div className="app">
      {page === "landing" && (
        <LandingPage
          config={config}
          setConfig={setConfig}
          onStart={() => setPage("interview")}
        />
      )}
      {page === "interview" && (
        <InterviewPage
          config={config}
          onFinish={(reportData) => {
            setReport(reportData);
            setPage("report");
          }}
        />
      )}
      {page === "report" && (
        <ReportPage
          report={report}
          onRestart={() => {
            setReport(null);
            setPage("landing");
          }}
        />
      )}
    </div>
  );
}