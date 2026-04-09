import { User } from "lucide-react";

// Generate a consistent color based on the name
const getAvatarColor = (name: string): string => {
  const colors = [
    "bg-purple-500",
    "bg-orange-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitial = (name: string): string => {
  return name.trim().charAt(0).toUpperCase();
};

const participants = [
  { id: 1, name: "Team Member 1", status: "speaking" },
  { id: 2, name: "Team Member 2", status: "active" },
  { id: 3, name: "Team Member 3", status: "active" },
];

const MeetingParticipants = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {participants.map((participant) => (
        <div
          key={participant.id}
          className={`relative aspect-video bg-meeting-bg rounded-lg overflow-hidden border-2 transition-all ${
            participant.status === "speaking"
              ? "border-accent shadow-lg"
              : "border-border/30"
          }`}
        >
          {/* Avatar with first letter of name */}
          <div className="absolute inset-0 flex items-center justify-center bg-[#3c4043]">
            <div className={`w-20 h-20 rounded-full ${getAvatarColor(participant.name)} flex items-center justify-center shadow-lg`}>
              <span className="text-3xl font-medium text-white">{getInitial(participant.name)}</span>
            </div>
          </div>

          {/* Participant Info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="text-white text-sm font-medium">{participant.name}</p>
            {participant.status === "speaking" && (
              <div className="flex items-center gap-1 mt-1">
                <div className="w-1 h-3 bg-accent rounded animate-pulse" />
                <div className="w-1 h-4 bg-accent rounded animate-pulse delay-75" />
                <div className="w-1 h-3 bg-accent rounded animate-pulse delay-150" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MeetingParticipants;
