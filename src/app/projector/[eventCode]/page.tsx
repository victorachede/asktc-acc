"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Mic,
  MessageSquare,
  Radio,
  Users,
  Trophy,
  BarChart2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { createClient } from "@/lib/supabase/client";
import type { Event, Question, Poll } from "@/types";

function QRCode({ value, size = 180 }: { value: string; size?: number }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor="transparent"
      fgColor="#ffffff"
      level="M"
      className="rounded-xl"
    />
  );
}

function EndSummary({
  questions,
  eventTitle,
}: {
  questions: Question[];
  eventTitle: string;
}) {
  const top3 = [...questions]
    .filter((q) => ["approved", "on_screen", "answered"].includes(q.status))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-center gap-3 mb-12">
        <Trophy size={28} className="text-yellow-400" />
        <div className="text-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-1">
            Event Ended
          </p>
          <h2 className="text-3xl font-bold text-white">{eventTitle}</h2>
        </div>
        <Trophy size={28} className="text-yellow-400" />
      </div>

      <p className="text-center text-gray-500 text-sm uppercase tracking-widest mb-8">
        Top Questions
      </p>

      <div className="space-y-4">
        {top3.length === 0 && (
          <p className="text-center text-gray-600">
            No questions were submitted.
          </p>
        )}
        {top3.map((q, i) => (
          <div
            key={q.id}
            className={`rounded-2xl p-6 flex items-start gap-5 ${
              i === 0
                ? "bg-yellow-400/10 border border-yellow-400/30"
                : i === 1
                  ? "bg-white/5 border border-white/10"
                  : "bg-white/3 border border-white/5"
            }`}
          >
            <span className="text-3xl shrink-0 mt-0.5">{medals[i]}</span>
            <div className="flex-1 min-w-0">
              <p
                className={`font-medium leading-snug mb-2 ${i === 0 ? "text-xl text-white" : "text-lg text-gray-200"}`}
              >
                {q.content}
              </p>
              <span className="text-sm text-gray-500">{q.asked_by}</span>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`font-bold ${i === 0 ? "text-2xl text-yellow-400" : "text-xl text-gray-400"}`}
              >
                {q.votes}
              </p>
              <p className="text-xs text-gray-600">votes</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PollDisplay({ poll, votes }: { poll: Poll; votes: number[] }) {
  const total = votes.reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...votes, 1);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-center gap-3 mb-10">
        <BarChart2 size={22} className="text-indigo-400" />
        <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest">
          Live Poll
        </p>
      </div>
      <p className="text-3xl sm:text-4xl font-semibold text-white text-center leading-tight mb-12">
        {poll.question}
      </p>
      <div className="space-y-5">
        {poll.options.map((opt, i) => {
          const pct = total > 0 ? Math.round((votes[i] / total) * 100) : 0;
          const isLeading = votes[i] === maxVotes && votes[i] > 0;
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-lg font-medium ${isLeading ? "text-white" : "text-gray-300"}`}
                >
                  {opt}
                </span>
                <span
                  className={`text-2xl font-bold font-mono ${isLeading ? "text-indigo-400" : "text-gray-500"}`}
                >
                  {pct}%
                </span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isLeading ? "bg-indigo-500" : "bg-white/20"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-gray-600 text-sm mt-8">
        {total} vote{total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default function Page() {
  const { eventCode } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [pollVotes, setPollVotes] = useState<number[]>([]);
  const [audienceCount, setAudienceCount] = useState(0);
  const [joinUrl, setJoinUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const currentQuestionRef = useRef<Question | null>(null);
  const activePollRef = useRef<Poll | null>(null);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join`);
    loadProjector();
  }, []);

  async function loadPollVotes(poll: Poll) {
    const supabase = createClient();
    const { data } = await supabase
      .from("poll_votes")
      .select("option_index")
      .eq("poll_id", poll.id);
    const tally = Array(poll.options.length).fill(0);
    data?.forEach((v) => {
      if (tally[v.option_index] !== undefined) tally[v.option_index]++;
    });
    setPollVotes(tally);
  }

  async function loadProjector() {
    const supabase = createClient();

    const { data: eventData } = await supabase
      .from("events")
      .select("*")
      .eq("event_code", String(eventCode).toUpperCase())
      .single();

    if (!eventData) {
      setLoading(false);
      return;
    }

    setEvent(eventData);

    const [
      { data: questionData },
      { data: allQuestionsData },
      { data: pollData },
    ] = await Promise.all([
      supabase
        .from("questions")
        .select("*")
        .eq("event_id", eventData.id)
        .eq("status", "on_screen")
        .maybeSingle(),
      supabase
        .from("questions")
        .select("*")
        .eq("event_id", eventData.id)
        .order("votes", { ascending: false }),
      supabase
        .from("polls")
        .select("*")
        .eq("event_id", eventData.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    setCurrentQuestion(questionData || null);
    currentQuestionRef.current = questionData || null;
    setAllQuestions(allQuestionsData || []);
    if (pollData) {
      setActivePoll(pollData);
      activePollRef.current = pollData;
      loadPollVotes(pollData);
    }
    setLoading(false);

    supabase
      .channel(`projector-${eventData.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
          filter: `event_id=eq.${eventData.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const q = payload.new as Question;
            setAllQuestions((prev) =>
              prev.map((item) => (item.id === q.id ? q : item)),
            );
            if (q.status === "on_screen") {
              setCurrentQuestion(q);
              currentQuestionRef.current = q;
            } else if (currentQuestionRef.current?.id === q.id) {
              setCurrentQuestion(null);
              currentQuestionRef.current = null;
            }
          }
          if (payload.eventType === "INSERT") {
            setAllQuestions((prev) => [...prev, payload.new as Question]);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventData.id}`,
        },
        (payload) => {
          setEvent((prev) => (prev ? { ...prev, ...payload.new } : prev));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "polls",
          filter: `event_id=eq.${eventData.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const p = payload.new as Poll;
            if (p.status === "active") {
              setActivePoll(p);
              activePollRef.current = p;
              loadPollVotes(p);
            } else if (p.status === "closed") {
              setActivePoll((prev) => (prev?.id === p.id ? null : prev));
              if (activePollRef.current?.id === p.id)
                activePollRef.current = null;
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "poll_votes",
        },
        () => {
          if (activePollRef.current) loadPollVotes(activePollRef.current);
        },
      )
      .subscribe();

    const presenceChannel = supabase.channel(`presence-${eventData.id}`, {
      config: { presence: { key: `proj-${Math.random()}` } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        setAudienceCount(Object.keys(presenceChannel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ role: "projector" });
        }
      });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-10 py-6">
        <span className="text-white font-bold text-lg tracking-tight">
          ASKTC
        </span>
        <div className="flex items-center gap-4">
          {audienceCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Users size={12} /> {audienceCount} in room
            </span>
          )}
          <span className="text-gray-400 text-sm">{event?.title}</span>
          {event?.status === "live" && (
            <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
              <Radio size={10} className="animate-pulse" /> Live
            </span>
          )}
          {event?.status === "ended" && (
            <span className="text-xs text-gray-600 font-medium">Ended</span>
          )}
        </div>
      </div>

      {/* MAIN DISPLAY */}
      <div className="flex-1 flex items-center justify-center px-16">
        {event?.status === "ended" ? (
          <EndSummary questions={allQuestions} eventTitle={event.title} />
        ) : currentQuestion ? (
          <div className="w-full max-w-5xl">
            <p className="text-xs font-medium text-blue-400 uppercase tracking-widest mb-8">
              Question
            </p>
            <p className="text-4xl sm:text-5xl font-semibold text-white leading-tight mb-10">
              {currentQuestion.content}
            </p>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-gray-400 text-sm">
                {currentQuestion.asked_by}
              </span>
              {currentQuestion.source === "voice" && (
                <span className="flex items-center gap-1.5 text-xs bg-purple-900/50 text-purple-300 px-3 py-1 rounded-full">
                  <Mic size={10} /> Voice
                </span>
              )}
            </div>
          </div>
        ) : activePoll ? (
          <PollDisplay poll={activePoll} votes={pollVotes} />
        ) : (
          <div className="flex items-center gap-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare size={28} className="text-gray-500" />
              </div>
              <p className="text-2xl font-semibold text-white mb-3">
                {event?.title}
              </p>
              <p className="text-gray-500 text-lg mb-8">
                Waiting for questions...
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-gray-600 text-sm">Join at</span>
                <span className="bg-white/10 text-white text-sm font-mono px-4 py-2 rounded-lg">
                  {joinUrl}
                </span>
                <span className="text-gray-600 text-sm">· code</span>
                <span className="bg-white/10 text-white text-sm font-mono px-4 py-2 rounded-lg tracking-widest">
                  {event?.event_code}
                </span>
              </div>
            </div>

            {joinUrl && event?.event_code && (
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="p-4 bg-white/5 rounded-2xl shadow-xl">
                  <QRCode
                    value={`${joinUrl}?code=${event.event_code}`}
                    size={180}
                  />
                </div>
                <p className="text-gray-600 text-xs">Scan to join</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="px-10 py-5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-gray-700">
          {audienceCount > 0 && (
            <>
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {audienceCount} in room
            </>
          )}
        </span>
        <span className="text-gray-700 text-xs">Powered by ASKTC</span>
      </div>
    </main>
  );
}
