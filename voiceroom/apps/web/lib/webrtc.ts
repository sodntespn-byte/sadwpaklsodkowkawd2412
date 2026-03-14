/**
 * ICE servers for WebRTC: STUN (discovery) + TURN (relay when NAT blocks).
 * In dev, use public STUN; set NEXT_PUBLIC_TURN_* for TURN (e.g. coturn).
 */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [];

  const stunUrl = process.env.NEXT_PUBLIC_STUN_SERVER_URL || 'stun:stun.l.google.com:19302';
  servers.push({ urls: stunUrl });

  const turnUrl = process.env.NEXT_PUBLIC_TURN_SERVER_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnPass = process.env.NEXT_PUBLIC_TURN_PASSWORD;
  if (turnUrl && turnUser && turnPass) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnPass,
    });
  }

  return servers;
}

export function createPeerConnection(
  onTrack: (event: RTCTrackEvent) => void,
  onIceCandidate: (candidate: RTCIceCandidate) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: getIceServers(),
  });

  pc.ontrack = onTrack;
  pc.onicecandidate = (e) => {
    if (e.candidate) onIceCandidate(e.candidate);
  };

  return pc;
}
