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
import { Video, Mic, Users, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const JoinMeeting = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const meetingId = searchParams.get("id") || "";

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("developer");
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    if (!meetingId) {
      navigate("/");
      return;
    }

    // Fetch meeting info
    const fetchMeetingInfo = async () => {
      const { data: meeting } = await supabase
        .from("meetings")
        .select("title")
        .eq("id", meetingId)
        .single();

      if (meeting) {
        setMeetingTitle(meeting.title);
      }

      const { count } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("meeting_id", meetingId);

      setParticipantCount(count || 0);
    };

    fetchMeetingInfo();
  }, [meetingId, navigate]);

  const handleJoinMeeting = async () => {
    if (!userName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to join the meeting.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Add participant with email
      await supabase.from("participants").insert({
        meeting_id: meetingId,
        name: userName,
        email: userEmail.trim() || null,
        role: userRole,
        engagement_score: 85,
        attention_score: 90,
      });

      navigate(`/meeting-demo?id=${meetingId}&name=${encodeURIComponent(userName)}`);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to join meeting. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-elevated">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary mb-2">
            <Video className="w-8 h-8 text-white" />
          </div>

          <div>
            <h1 className="text-2xl font-bold mb-2">Join Meeting</h1>
            {meetingTitle && (
              <p className="text-lg text-foreground font-medium">{meetingTitle}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-muted-foreground mt-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">
                {participantCount} {participantCount === 1 ? "participant" : "participants"} in meeting
              </span>
            </div>
          </div>

          <div className="space-y-4 text-left">
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
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="userEmail" className="text-primary font-medium">
                Email <span className="text-muted-foreground font-normal">(for summary delivery)</span>
              </Label>
              <Input
                id="userEmail"
                type="email"
                placeholder="your.email@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="bg-background border-border"
              />
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
                  <SelectItem value="supervisor">Supervisor</SelectItem>
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

            <Button
              className="w-full bg-gradient-primary hover:opacity-90 text-white py-6 text-base font-medium"
              onClick={handleJoinMeeting}
              disabled={isLoading || !userName.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Meeting"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default JoinMeeting;
