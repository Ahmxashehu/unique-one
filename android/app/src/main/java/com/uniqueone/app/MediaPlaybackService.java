package com.uniqueone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import java.util.ArrayList;
import java.util.Random;

public class MediaPlaybackService extends Service {
    public static final String ACTION_PLAY = "com.uniqueone.app.PLAY";
    public static final String ACTION_PAUSE = "com.uniqueone.app.PAUSE";
    public static final String ACTION_RESUME = "com.uniqueone.app.RESUME";
    public static final String ACTION_STOP = "com.uniqueone.app.STOP";
    public static final String ACTION_SEEK = "com.uniqueone.app.SEEK";
    public static final String ACTION_REPEAT = "com.uniqueone.app.REPEAT";
    public static final String ACTION_SHUFFLE = "com.uniqueone.app.SHUFFLE";
    public static final String EXTRA_URIS = "uris";
    public static final String EXTRA_NAMES = "names";
    public static final String EXTRA_INDEX = "index";
    public static final String EXTRA_SEEK_SECONDS = "seek_seconds";

    private static final String CHANNEL = "unique_media_playback";
    private final ArrayList<String> uris = new ArrayList<>();
    private final ArrayList<String> names = new ArrayList<>();
    private final Random random = new Random();
    private int index = 0;
    private boolean repeat = false;
    private boolean shuffle = false;
    private MediaPlayer player;
    private MediaSession session;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        session = new MediaSession(this, "UniqueMedia");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { resumePlayback(); }
            @Override public void onPause() { pausePlayback(); }
            @Override public void onSkipToNext() { skipNext(); }
            @Override public void onSkipToPrevious() { skipPrevious(); }
            @Override public void onSeekTo(long position) {
                if (player != null && player.isPlaying()) {
                    try { player.seekTo((int) Math.max(0, Math.min(position, player.getDuration()))); } catch (Exception ignored) {}
                    updateSession();
                }
            }
            @Override public void onStop() { stopPlayback(); }
        });
        session.setActive(true);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        try {
            String action = intent.getAction();
            if (ACTION_PLAY.equals(action)) {
                JSONArray incomingUris = new JSONArray(intent.getStringExtra(EXTRA_URIS));
                JSONArray incomingNames = new JSONArray(intent.getStringExtra(EXTRA_NAMES));
                uris.clear();
                names.clear();
                for (int i = 0; i < incomingUris.length(); i++) uris.add(incomingUris.getString(i));
                for (int i = 0; i < incomingNames.length(); i++) names.add(incomingNames.getString(i));
                if (uris.isEmpty()) { stopPlayback(); return START_NOT_STICKY; }
                index = Math.max(0, Math.min(intent.getIntExtra(EXTRA_INDEX, 0), uris.size() - 1));
                startForeground(21, notification("Preparing " + currentName()));
                if (session != null) session.setActive(true);
                playCurrent();
            } else if (ACTION_PAUSE.equals(action)) {
                pausePlayback();
            } else if (ACTION_RESUME.equals(action)) {
                resumePlayback();
            } else if (ACTION_STOP.equals(action)) {
                stopPlayback();
            } else if (ACTION_SEEK.equals(action)) {
                seekBySeconds(intent.getIntExtra(EXTRA_SEEK_SECONDS, 0));
            } else if (ACTION_REPEAT.equals(action)) {
                repeat = !repeat;
            } else if (ACTION_SHUFFLE.equals(action)) {
                shuffle = !shuffle;
            }
        } catch (Exception ignored) {}
        return START_STICKY;
    }

    private String currentName() {
        return index >= 0 && index < names.size() ? names.get(index) : "UniqueMedia";
    }

    private void playCurrent() {
        releasePlayer();
        if (index < 0 || index >= uris.size()) { stopPlayback(); return; }
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            player.setDataSource(this, android.net.Uri.parse(uris.get(index)));
            player.setOnPreparedListener(mp -> {
                mp.start();
                updateSession();
                updateNotification();
            });
            player.setOnCompletionListener(mp -> advance());
            player.setOnErrorListener((mp, what, extra) -> {
                advance();
                return true;
            });
            player.prepareAsync();
        } catch (Exception ignored) {
            updateNotification();
        }
    }

    private void playIndex(int next) {
        if (next < 0 || next >= uris.size()) return;
        index = next;
        startForeground(21, notification("Playing " + currentName()));
        playCurrent();
    }

    private void advance() {
        if (uris.isEmpty()) { stopPlayback(); return; }
        if (shuffle && uris.size() > 1) {
            int next = index;
            while (next == index) next = random.nextInt(uris.size());
            playIndex(next);
        } else if (index + 1 < uris.size()) {
            playIndex(index + 1);
        } else if (repeat) {
            playIndex(0);
        } else {
            stopPlayback();
        }
    }

    private void skipNext() {
        if (shuffle && uris.size() > 1) {
            int next = index;
            while (next == index) next = random.nextInt(uris.size());
            playIndex(next);
        } else if (index + 1 < uris.size()) {
            playIndex(index + 1);
        } else if (repeat && !uris.isEmpty()) {
            playIndex(0);
        }
    }

    private void skipPrevious() {
        if (index > 0) playIndex(index - 1);
        else if (repeat && !uris.isEmpty()) playIndex(uris.size() - 1);
        else if (player != null) {
            try { player.seekTo(0); } catch (Exception ignored) {}
        }
    }

    private void seekBySeconds(int seconds) {
        if (player == null) return;
        try {
            int duration = player.getDuration();
            int position = player.getCurrentPosition() + seconds * 1000;
            player.seekTo(Math.max(0, Math.min(position, Math.max(0, duration))));
            updateSession();
        } catch (Exception ignored) {}
    }

    private void pausePlayback() {
        if (player != null && player.isPlaying()) player.pause();
        updateSession();
        updateNotification();
    }

    private void resumePlayback() {
        if (player != null) {
            try { player.start(); } catch (Exception ignored) {}
            updateSession();
            updateNotification();
        } else if (!uris.isEmpty()) {
            playCurrent();
        }
    }

    private void updateSession() {
        if (session == null) return;
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | PlaybackState.ACTION_STOP | PlaybackState.ACTION_SEEK_TO;
        int state = player != null && player.isPlaying()
                ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        long position = 0;
        try { if (player != null) position = player.getCurrentPosition(); } catch (Exception ignored) {}
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, currentName())
                .putString(MediaMetadata.METADATA_KEY_ARTIST, "UniqueMedia")
                .putString(MediaMetadata.METADATA_KEY_ALBUM, "UniqueMedia")
                .build());
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(actions)
                .setState(state, position, state == PlaybackState.STATE_PLAYING ? 1f : 0f)
                .build());
    }

    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(21, notification((player != null && player.isPlaying() ? "Playing " : "Paused • ") + currentName()));
    }

    private Notification notification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        return builder.setContentTitle("UniqueMedia")
                .setContentText(text)
                .setSmallIcon(com.uniqueone.app.R.drawable.up_icon)
                .setContentIntent(pending)
                .setOngoing(player != null && player.isPlaying())
                .setCategory(Notification.CATEGORY_TRANSPORT)
                .build();
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
    }

    private void stopPlayback() {
        releasePlayer();
        if (session != null) {
            session.setActive(false);
            session.setPlaybackState(new PlaybackState.Builder()
                    .setState(PlaybackState.STATE_STOPPED, 0, 0f).build());
        }
        stopForeground(true);
        stopSelf();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "UniqueMedia playback", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Background audio controls for UniqueMedia");
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override public void onDestroy() {
        releasePlayer();
        if (session != null) session.release();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}