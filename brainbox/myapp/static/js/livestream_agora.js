/**
 * Agora SDK Integration Helper for EduLink Livestream
 * This code helps initialize and manage Agora RTC connections for students
 * viewing teacher livestreams.
 */

class AgoraStreamManager {
    constructor(options = {}) {
      this.appId = options.appId || '';
      this.channel = options.channel || '';
      this.token = options.token || null;
      this.uid = options.uid || 0;
      this.role = options.role || 'audience';  // Default is audience for students
      
      this.client = null;
      this.localTracks = {
        audioTrack: null,
        videoTrack: null
      };
      this.remoteUsers = {};
      this.isScreenSharing = false;
      
      this.onUserPublished = options.onUserPublished || null;
      this.onUserUnpublished = options.onUserUnpublished || null;
      this.onJoinSuccess = options.onJoinSuccess || null;
      this.onError = options.onError || null;
    }
    
    /**
     * Initialize the Agora client
     */
    async initializeClient() {
      try {
        // Create an Agora client instance
        this.client = AgoraRTC.createClient({ 
          mode: 'live', 
          codec: 'vp8'
        });
        
        // Set client role based on the role (host for teacher, audience for students)
        await this.client.setClientRole(this.role);
        
        // Set up event handlers
        this.client.on('user-published', async (user, mediaType) => {
          // Subscribe to the remote user when they publish
          await this.client.subscribe(user, mediaType);
          
          // Handle the subscribed stream
          if (mediaType === 'video') {
            // Store the remote user's video track
            this.remoteUsers[user.uid] = user;
            
            // Callback to notify that a user has published
            if (this.onUserPublished) {
              this.onUserPublished(user, mediaType);
            }
          }
          
          if (mediaType === 'audio') {
            // Play the audio
            user.audioTrack.play();
          }
        });
        
        // When remote user stops publishing media
        this.client.on('user-unpublished', (user, mediaType) => {
          // Handle user unpublishing
          if (mediaType === 'video') {
            delete this.remoteUsers[user.uid];
          }
          
          // Callback to notify that a user has stopped publishing
          if (this.onUserUnpublished) {
            this.onUserUnpublished(user, mediaType);
          }
        });
        
        return true;
      } catch (error) {
        console.error('Error initializing Agora client:', error);
        if (this.onError) {
          this.onError(error);
        }
        return false;
      }
    }
    
    /**
     * Join the Agora channel as a student (audience)
     */
    async join() {
      try {
        // Initialize the client if not already initialized
        if (!this.client) {
          await this.initializeClient();
        }
        
        // Join the channel
        await this.client.join(this.appId, this.channel, this.token, this.uid);
        
        console.log('Successfully joined Agora channel:', this.channel);
        
        // Callback to notify successful join
        if (this.onJoinSuccess) {
          this.onJoinSuccess();
        }
        
        return true;
      } catch (error) {
        console.error('Error joining Agora channel:', error);
        if (this.onError) {
          this.onError(error);
        }
        return false;
      }
    }
    
    /**
     * Leave the Agora channel and release resources
     */
    async leave() {
      try {
        // Leave the channel
        await this.client.leave();
        
        // Reset remote users
        this.remoteUsers = {};
        
        console.log('Left Agora channel successfully');
        return true;
      } catch (error) {
        console.error('Error leaving Agora channel:', error);
        return false;
      }
    }
    
    /**
     * Play a remote user's video in a specific container
     * @param {string} uid - Remote user ID
     * @param {string} containerId - DOM container ID to play the video in
     */
    playRemoteVideo(uid, containerId) {
      const user = this.remoteUsers[uid];
      if (user && user.videoTrack) {
        user.videoTrack.play(containerId);
        return true;
      }
      return false;
    }
    
    /**
     * Check if the Agora client is connected
     */
    isConnected() {
      return this.client && this.client.connectionState === 'CONNECTED';
    }
    
    /**
     * Set the stream type for optimizing for screen share or camera
     * @param {number} uid - Remote user ID
     * @param {string} streamType - 'high' or 'low'
     */
    async setRemoteVideoStreamType(uid, streamType) {
      if (!this.client) return false;
      
      try {
        await this.client.setRemoteVideoStreamType(uid, streamType === 'high' ? 0 : 1);
        return true;
      } catch (error) {
        console.error('Error setting remote video stream type:', error);
        return false;
      }
    }
    
    /**
     * Get stats about the current connection
     */
    async getConnectionStats() {
      if (!this.client) return null;
      
      try {
        const stats = await this.client.getTransportStats();
        return stats;
      } catch (error) {
        console.error('Error getting transport stats:', error);
        return null;
      }
    }
    
    /**
     * Handle reconnection in case of network issues
     */
    setupReconnection() {
      if (!this.client) return;
      
      this.client.on('connection-state-change', (curState, prevState) => {
        console.log('Agora connection state changed from', prevState, 'to', curState);
        
        if (curState === 'DISCONNECTED') {
          console.log('Trying to reconnect to Agora channel...');
        }
      });
    }
  }
  
  // Example usage:
  /*
  const streamManager = new AgoraStreamManager({
    appId: 'your-app-id',
    channel: 'channel-name',
    token: 'your-token',
    uid: 123456,
    onUserPublished: (user, mediaType) => {
      if (mediaType === 'video') {
        // Play the video in a container
        user.videoTrack.play('remote-stream-container');
      }
    },
    onError: (error) => {
      console.error('Agora error:', error);
      // Show error message to user
    }
  });
  
  // Join the channel
  streamManager.join().then(success => {
    if (success) {
      console.log('Successfully joined the stream!');
    }
  });
  
  // Later, when leaving:
  streamManager.leave();
  */