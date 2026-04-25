import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Linkedin,
  Sparkles,
  Copy,
  CheckCheck,
  Zap,
  Hash,
  Quote,
  RefreshCw,
} from "lucide-react";

type Tone = "professional" | "storytelling" | "motivational";

interface PostResult {
  hook: string;
  post: string;
  hashtags: string[];
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LinkedInGenerator() {
  const { toast } = useToast();

  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [loading, setLoading] = useState(false);
  const [viralLoading, setViralLoading] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [copiedPost, setCopiedPost] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState("");

  const generatePost = async () => {
    if (!topic.trim()) {
      toast({ title: "Please enter a topic", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/linkedin/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), tone }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = (await res.json()) as PostResult;
      setResult(data);
    } catch {
      toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const makeViral = async () => {
    if (!result) return;
    setViralLoading(true);
    try {
      const res = await fetch(`${BASE}/api/linkedin/make-viral`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post: result.post, hashtags: result.hashtags }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as PostResult;
      setResult(data);
      toast({ title: "🔥 Post supercharged!", description: "Your post has been made more viral." });
    } catch {
      toast({ title: "Failed to enhance post", variant: "destructive" });
    } finally {
      setViralLoading(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedMsg(label);
    setCopiedPost(true);
    setTimeout(() => setCopiedPost(false), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
  };

  const fullPostText = result
    ? `${result.hook}\n\n${result.post}\n\n${result.hashtags.join(" ")}`
    : "";

  const toneOptions: { value: Tone; label: string; desc: string; color: string }[] = [
    { value: "professional", label: "Professional", desc: "Data-driven, authoritative insights", color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30" },
    { value: "storytelling", label: "Storytelling", desc: "Personal narrative & real experience", color: "border-purple-500 bg-purple-50 dark:bg-purple-950/30" },
    { value: "motivational", label: "Motivational", desc: "Inspiring, energetic, action-oriented", color: "border-orange-500 bg-orange-50 dark:bg-orange-950/30" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Linkedin className="h-8 w-8 text-[#0A66C2]" />
          LinkedIn Content Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate scroll-stopping LinkedIn posts in seconds with AI.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Input Panel */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
          <Card className="border-border/50 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Create Your Post
              </CardTitle>
              <CardDescription>Tell the AI what you want to write about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic / Idea</Label>
                <Textarea
                  id="topic"
                  placeholder="e.g. How I landed my dream job after 50 rejections, Why AI won't replace developers, 5 lessons from my startup failure..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">Be specific — the more detail, the better the post.</p>
              </div>

              <div className="space-y-3">
                <Label>Tone</Label>
                <div className="grid gap-2">
                  {toneOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTone(opt.value)}
                      className={`flex items-start gap-3 border rounded-lg p-3 text-left transition-all cursor-pointer ${
                        tone === opt.value
                          ? `${opt.color} border-2`
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </div>
                      {tone === opt.value && (
                        <CheckCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
                onClick={generatePost}
                disabled={loading || !topic.trim()}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-5 w-5" /> Generate Post</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Output Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-4">
          <AnimatePresence mode="wait">
            {!result && !loading && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Card className="bg-secondary/30 border-dashed border-2 h-full min-h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-3 p-8">
                    <Linkedin className="h-12 w-12 text-[#0A66C2]/30 mx-auto" />
                    <p className="text-muted-foreground text-sm">Your generated post will appear here</p>
                    <p className="text-xs text-muted-foreground">Fill in a topic and click Generate</p>
                  </div>
                </Card>
              </motion.div>
            )}

            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <Card className="border-border/50 h-full min-h-[400px] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="relative mx-auto h-16 w-16">
                      <Loader2 className="h-16 w-16 animate-spin text-primary/20" />
                      <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
                    </div>
                    <div>
                      <p className="font-medium">AI is crafting your post…</p>
                      <p className="text-sm text-muted-foreground mt-1">This takes about 5–10 seconds</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Hook */}
                <Card className="border-l-4 border-l-[#0A66C2] shadow-sm">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-2 mb-2">
                      <Quote className="h-4 w-4 text-[#0A66C2] shrink-0 mt-0.5" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#0A66C2]">Hook</span>
                    </div>
                    <p className="font-bold text-lg leading-tight">{result.hook}</p>
                  </CardContent>
                </Card>

                {/* Full Post */}
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Post</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(fullPostText, "Post")}
                        className="h-7 px-2 text-xs"
                      >
                        {copiedPost && copiedMsg === "Post" ? (
                          <><CheckCheck className="h-3.5 w-3.5 mr-1 text-green-500" /> Copied!</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1" /> Copy All</>
                        )}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.post}</p>
                  </CardContent>
                </Card>

                {/* Hashtags */}
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hashtags</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyText(result.hashtags.join(" "), "Hashtags")}
                        className="h-7 px-2 text-xs"
                      >
                        {copiedPost && copiedMsg === "Hashtags" ? (
                          <><CheckCheck className="h-3.5 w-3.5 mr-1 text-green-500" /> Copied!</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-[#0A66C2]/10 px-3 py-1 text-xs font-medium text-[#0A66C2] dark:bg-[#0A66C2]/20"
                        >
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={makeViral}
                    disabled={viralLoading}
                  >
                    {viralLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Supercharging…</>
                    ) : (
                      <><Zap className="mr-2 h-4 w-4 text-yellow-500" /> Make it More Viral</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={generatePost}
                    disabled={loading}
                    className="flex-1"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
