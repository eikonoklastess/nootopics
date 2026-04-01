import { useLocalParticipant, DisconnectButton } from '@livekit/components-react';

export function Controls() {
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleCamera = () => {
    localParticipant.setCameraEnabled(!isCameraEnabled);
  };

  return (
    <div className="bg-[#2b2d31] p-4 flex items-center justify-center gap-4 border-t border-zinc-800">
      <button
        onClick={toggleCamera}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-md ${
          isCameraEnabled ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-[#313338] hover:bg-zinc-700'
        } text-white`}
        title="Toggle Camera"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
           {isCameraEnabled ? (
             <path d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z" />
           ) : (
             <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
           )}
        </svg>
      </button>

      <button
        onClick={toggleMic}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-md ${
          isMicrophoneEnabled ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-[#313338] hover:bg-zinc-700'
        } text-white`}
        title="Toggle Microphone"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          {isMicrophoneEnabled ? (
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
          ) : (
             <path d="M19 11h-1.7c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          )}
        </svg>
      </button>

      <DisconnectButton className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-md transition-colors" title="Leave">
         <span className="font-semibold px-2">End</span>
      </DisconnectButton>
    </div>
  );
}
