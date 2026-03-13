'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  type Participant,
  type RoomStatePayload,
  type ParticipantJoinedPayload,
  type ParticipantLeftPayload,
  type RtcOfferPayload,
  type RtcAnswerPayload,
  type RtcIceCandidatePayload,
  type MuteStateChangedPayload,
  type SpeakingStateChangedPayload,
} from '@voiceroom/shared';
import { createPeerConnection } from '@/lib/webrtc';

export interface UseVoiceRoomOptions {
  roomId: string;
  socket: Socket | null;
  userId: string;
  userName: string;
  /** Called when room state or participants change */
  onParticipants?: (participants: Participant[]) => void;
  /** Called when we receive remote track (socketId, stream) */
  onRemoteTrack?: (socketId: string, stream: MediaStream) => void;
}

export function useVoiceRoom({
  roomId,
  socket,
  userId,
  userName,
  onParticipants,
  onRemoteTrack,
}: UseVoiceRoomOptions) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const addParticipant = useCallback(
    (p: Participant) => {
      setParticipants((prev) => {
        const next = prev.filter((x) => x.socketId !== p.socketId);
        if (!next.find((x) => x.socketId === p.socketId)) next.push(p);
        onParticipants?.(next);
        return next;
      });
    },
    [onParticipants]
  );

  const removeParticipant = useCallback(
    (socketId: string) => {
      const pc = peersRef.current.get(socketId);
      if (pc) {
        pc.close();
        peersRef.current.delete(socketId);
      }
      setParticipants((prev) => {
        const next = prev.filter((p) => p.socketId !== socketId);
        onParticipants?.(next);
        return next;
      });
    },
    [onParticipants]
  );

  const updateParticipant = useCallback(
    (socketId: string, patch: Partial<Participant>) => {
      setParticipants((prev) => {
        const next = prev.map((p) => (p.socketId === socketId ? { ...p, ...patch } : p));
        onParticipants?.(next);
        return next;
      });
    },
    [onParticipants]
  );

  // ---- Get user media and create peer for a remote participant ----
  const createPeerFor = useCallback(
    (remoteSocketId: string, isInitiator: boolean) => {
      if (peersRef.current.has(remoteSocketId)) return;
      if (!socket || !localStreamRef.current) return;

      const pc = createPeerConnection(
        (event) => {
          const stream = event.streams[0];
          if (stream) onRemoteTrack?.(remoteSocketId, stream);
        },
        (candidate) => {
          socket.emit(SOCKET_EVENTS.RTC_ICE_CANDIDATE, {
            roomId,
            targetSocketId: remoteSocketId,
            candidate: candidate.toJSON(),
          });
        }
      );

      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
      peersRef.current.set(remoteSocketId, pc);

      if (isInitiator) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit(SOCKET_EVENTS.RTC_OFFER, {
              roomId,
              targetSocketId: remoteSocketId,
              sdp: pc.localDescription!.toJSON(),
            });
          })
          .catch((err) => console.error('createOffer error', err));
      }
    },
    [roomId, socket, onRemoteTrack]
  );

  // ---- Join room and handle signaling ----
  useEffect(() => {
    if (!socket || !roomId) return;

    const onRoomState = (payload: RoomStatePayload) => {
      if (payload.roomId !== roomId) return;
      setParticipants(payload.participants);
      setConnectionStatus('connected');
      setError(null);
      onParticipants?.(payload.participants);
      payload.participants.forEach((p) => {
        if (p.socketId !== socket.id) createPeerFor(p.socketId, true);
      });
    };

    const onParticipantJoined = (payload: ParticipantJoinedPayload) => {
      if (payload.roomId !== roomId) return;
      addParticipant(payload.participant);
      if (payload.participant.socketId !== socket.id) {
        createPeerFor(payload.participant.socketId, true);
      }
    };

    const onParticipantLeft = (payload: ParticipantLeftPayload) => {
      if (payload.roomId !== roomId) return;
      removeParticipant(payload.socketId);
    };

    const onRtcOffer = async (payload: RtcOfferPayload) => {
      if (payload.roomId !== roomId || payload.targetSocketId !== socket.id) return;
      let pc = peersRef.current.get(payload.fromSocketId);
      if (!pc) {
        pc = createPeerConnection(
          (event) => {
            const stream = event.streams[0];
            if (stream) onRemoteTrack?.(payload.fromSocketId, stream);
          },
          (candidate) => {
            socket.emit(SOCKET_EVENTS.RTC_ICE_CANDIDATE, {
              roomId,
              targetSocketId: payload.fromSocketId,
              candidate: candidate.toJSON(),
            });
          }
        );
        localStreamRef.current?.getTracks().forEach((track) => pc!.addTrack(track, localStreamRef.current!));
        peersRef.current.set(payload.fromSocketId, pc);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(SOCKET_EVENTS.RTC_ANSWER, {
        roomId,
        targetSocketId: payload.fromSocketId,
        sdp: pc.localDescription!.toJSON(),
      });
    };

    const onRtcAnswer = async (payload: RtcAnswerPayload) => {
      if (payload.roomId !== roomId || payload.targetSocketId !== socket.id) return;
      const pc = peersRef.current.get(payload.fromSocketId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    };

    const onRtcIceCandidate = async (payload: RtcIceCandidatePayload) => {
      if (payload.roomId !== roomId || payload.targetSocketId !== socket.id) return;
      const pc = peersRef.current.get(payload.fromSocketId);
      if (pc && payload.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.warn('addIceCandidate error', e);
        }
      }
    };

    const onMuteState = (payload: MuteStateChangedPayload) => {
      if (payload.roomId !== roomId) return;
      updateParticipant(payload.socketId, { isMuted: payload.isMuted });
    };

    const onSpeakingState = (payload: SpeakingStateChangedPayload) => {
      if (payload.roomId !== roomId) return;
      updateParticipant(payload.socketId, { isSpeaking: payload.isSpeaking });
    };

    const onRoomFull = () => {
      setConnectionStatus('error');
      setError('Sala cheia');
    };
    const onAccessDenied = () => {
      setConnectionStatus('error');
      setError('Acesso negado');
    };
    const onRoomNotFound = () => {
      setConnectionStatus('error');
      setError('Sala não encontrada');
    };

    socket.on(SOCKET_EVENTS.ROOM_STATE, onRoomState);
    socket.on(SOCKET_EVENTS.PARTICIPANT_JOINED, onParticipantJoined);
    socket.on(SOCKET_EVENTS.PARTICIPANT_LEFT, onParticipantLeft);
    socket.on(SOCKET_EVENTS.RTC_OFFER, onRtcOffer);
    socket.on(SOCKET_EVENTS.RTC_ANSWER, onRtcAnswer);
    socket.on(SOCKET_EVENTS.RTC_ICE_CANDIDATE, onRtcIceCandidate);
    socket.on(SOCKET_EVENTS.MUTE_STATE_CHANGED, onMuteState);
    socket.on(SOCKET_EVENTS.SPEAKING_STATE_CHANGED, onSpeakingState);
    socket.on(SOCKET_EVENTS.ROOM_FULL, onRoomFull);
    socket.on(SOCKET_EVENTS.ACCESS_DENIED, onAccessDenied);
    socket.on(SOCKET_EVENTS.ROOM_NOT_FOUND, onRoomNotFound);

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_STATE, onRoomState);
      socket.off(SOCKET_EVENTS.PARTICIPANT_JOINED, onParticipantJoined);
      socket.off(SOCKET_EVENTS.PARTICIPANT_LEFT, onParticipantLeft);
      socket.off(SOCKET_EVENTS.RTC_OFFER, onRtcOffer);
      socket.off(SOCKET_EVENTS.RTC_ANSWER, onRtcAnswer);
      socket.off(SOCKET_EVENTS.RTC_ICE_CANDIDATE, onRtcIceCandidate);
      socket.off(SOCKET_EVENTS.MUTE_STATE_CHANGED, onMuteState);
      socket.off(SOCKET_EVENTS.SPEAKING_STATE_CHANGED, onSpeakingState);
      socket.off(SOCKET_EVENTS.ROOM_FULL, onRoomFull);
      socket.off(SOCKET_EVENTS.ACCESS_DENIED, onAccessDenied);
      socket.off(SOCKET_EVENTS.ROOM_NOT_FOUND, onRoomNotFound);
    };
  }, [socket, roomId, addParticipant, removeParticipant, updateParticipant, createPeerFor, onRemoteTrack]);

  // ---- Request mic, join room, start speaking detection ----
  useEffect(() => {
    if (!socket || !roomId) return;

    setConnectionStatus('connecting');
    setError(null);

    let stream: MediaStream | null = null;
    let speakingInterval: ReturnType<typeof setInterval> | null = null;
    const speakingRef = { current: false };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        localStreamRef.current = s;
        stream = s;
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId });

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioContext.createMediaStreamSource(s).connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        speakingInterval = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length;
          const speaking = avg > 15;
          if (speaking !== speakingRef.current) {
            speakingRef.current = speaking;
            setIsSpeaking(speaking);
            socket.emit(SOCKET_EVENTS.SPEAKING_STATE_CHANGED, { roomId, isSpeaking: speaking });
          }
        }, 200);
      })
      .catch((err) => {
        setConnectionStatus('error');
        setError(err.name === 'NotAllowedError' ? 'Permissão de microfone negada.' : 'Não foi possível acessar o microfone.');
      });

    return () => {
      if (speakingInterval) clearInterval(speakingInterval);
      stream?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId });
    };
  }, [socket, roomId]);

  const setMuted = useCallback(
    (muted: boolean) => {
      if (!localStreamRef.current) return;
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !muted));
      setIsMuted(muted);
      socket?.emit(SOCKET_EVENTS.MUTE_STATE_CHANGED, { roomId, isMuted: muted });
    },
    [socket, roomId]
  );

  return {
    participants,
    connectionStatus,
    error,
    isMuted,
    isSpeaking,
    setMuted,
  };
}
