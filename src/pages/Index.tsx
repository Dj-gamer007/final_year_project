import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, Mic, Check, LogOut, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { auth } from "@/integrations/firebase/client";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useFirebaseAuth } from "@/components/FirebaseAuthProvider";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const [activeTab, setActiveTab] = useState<"join" | "create">("join");
  const [meetingCode, setMeetingCode] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("developer");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUserEmail(user.email);
      if (!userName) setUserName(user.displayName || user.email?.split('@')[0] || "");
    }
  }, [user, userName]);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const features = [
    "Live transcription and action item tracking",
    "Role-based summaries for each participant",
    "Engagement analysis and scoring",
    "Export summaries as PDF",
  ];

  const handleJoinMeeting = async () => {
    if (!meetingCode.trim() || !userName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter the meeting code and your name.",
        variant: "destructive",
      });
      return;
    }

    if (userEmail && !isValidEmail(userEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Find meeting by code
      const { data: meeting, error } = await supabase
        .from("meetings")
        .select("id")
        .eq("meeting_code", meetingCode.trim())
        .single();

      if (error || !meeting) {
        toast({
          title: "Meeting Not Found",
          description: "Please check the meeting code and try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Add participant
      await supabase.from("participants").insert({
        meeting_id: meeting.id,
        name: userName,
        email: userEmail,
        role: userRole,
        engagement_score: 85,
        attention_score: 90,
      });

      navigate(`/meeting-demo?id=${meeting.id}&name=${encodeURIComponent(userName)}`);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to join meeting. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleCreateMeeting = async () => {
    if (!meetingTitle.trim() || !userName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter the meeting title and your name.",
        variant: "destructive",
      });
      return;
    }

    if (userEmail && !isValidEmail(userEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const meetingCodeGen = Math.random().toString(36).substring(2, 10).toUpperCase();

      // Create meeting
      const { data: meeting, error } = await supabase
        .from("meetings")
        .insert({
          title: meetingTitle,
          meeting_code: meetingCodeGen,
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !meeting) {
        throw new Error("Failed to create meeting");
      }

      // Add creator as participant
      await supabase.from("participants").insert({
        meeting_id: meeting.id,
        name: userName,
        email: userEmail,
        role: userRole,
        engagement_score: 100,
        attention_score: 100,
      });

      toast({
        title: "Meeting Created",
        description: `Meeting code: ${meetingCodeGen}`,
      });

      navigate(`/meeting-demo?id=${meeting.id}&name=${encodeURIComponent(userName)}`);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to create meeting. Please try again.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-4xl overflow-hidden shadow-elevated flex flex-col md:flex-row">
        {/* Left Panel - Blue Gradient */}
        <div className="md:w-1/2 bg-gradient-to-br from-[hsl(221,83%,53%)] to-[hsl(240,70%,40%)] p-8 md:p-12 flex flex-col justify-center text-white rounded-t-lg md:rounded-l-lg md:rounded-tr-none">
          <h1 className="text-3xl md:text-4xl font-bold italic mb-4">AI Meeting Hub</h1>
          <p className="text-white/90 mb-8">
            Real-time meeting summarization with AI-powered insights
          </p>

          <ul className="space-y-4">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-white/90 flex-shrink-0" />
                <span className="text-white/90">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Panel - Form */}
        <div className="md:w-1/2 p-8 md:p-12 bg-card">
          {/* Tab Toggle */}
          <div className="flex mb-8 bg-secondary rounded-lg p-1">
            <button
              onClick={() => setActiveTab("join")}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === "join"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Join Meeting
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === "create"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Meeting
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            {activeTab === "join" ? (
              <div className="space-y-2">
                <Label htmlFor="meetingCode" className="text-primary font-medium">
                  Meeting Code
                </Label>
                <Input
                  id="meetingCode"
                  placeholder="Enter meeting code"
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="meetingTitle" className="text-primary font-medium">
                  Meeting Title
                </Label>
                <Input
                  id="meetingTitle"
                  placeholder="Enter meeting title"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="userName" className="text-primary font-medium">
                Your Name
              </Label>
              <Input
                id="userName"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userEmail" className="text-primary font-medium">
                Your Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="userEmail"
                  type="email"
                  placeholder="Enter your email for summary delivery"
                  value={userEmail || ""}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="bg-background border-border pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">Meeting summary & PDF will be sent to this email</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userRole" className="text-primary font-medium">
                Your Role
              </Label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="designer">Designer</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Video/Audio Toggles */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant={videoEnabled ? "default" : "outline"}
                className={`flex-1 ${videoEnabled ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20" : ""}`}
                onClick={() => setVideoEnabled(!videoEnabled)}
              >
                <Video className="w-4 h-4 mr-2" />
                Video
              </Button>
              <Button
                type="button"
                variant={audioEnabled ? "default" : "outline"}
                className={`flex-1 ${audioEnabled ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20" : ""}`}
                onClick={() => setAudioEnabled(!audioEnabled)}
              >
                <Mic className="w-4 h-4 mr-2" />
                Audio
              </Button>
            </div>

            {/* Main Action Button */}
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-base font-medium"
              onClick={activeTab === "join" ? handleJoinMeeting : handleCreateMeeting}
              disabled={isLoading}
            >
              {isLoading
                ? "Please wait..."
                : activeTab === "join"
                ? "Join Meeting"
                : "Create Meeting"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Index;
