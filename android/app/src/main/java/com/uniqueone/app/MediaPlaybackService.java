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
    public static final String ACTION_PLAY="com.uniqueone.app.PLAY";
    public static final String ACTION_PAUSE="com.uniqueone.app.PAUSE";
    public static final String ACTION_RESUME="com.uniqueone.app.RESUME";
    public static final String ACTION_STOP="com.uniqueone.app.STOP";
    public static final String ACTION_NEXT="com.uniqueone.app.NEXT";
    public static final String ACTION_PREVIOUS="com.uniqueone.app.PREVIOUS";
    public static final String ACTION_REPEAT="com.uniqueone.app.REPEAT";
    public static final String ACTION_SHUFFLE="com.uniqueone.app.SHUFFLE";
    public static final String ACTION_SEEK="com.uniqueone.app.SEEK";
    public static final String EXTRA_URIS="uris", EXTRA_NAMES="names", EXTRA_INDEX="index", EXTRA_SEEK_SECONDS="seekSeconds";
    private static final String CHANNEL="unique_media_playback";
    private final ArrayList<String> uris=new ArrayList<>(), names=new ArrayList<>();
    private final Random random=new Random();
    private int index=0;
    private MediaPlayer player;
    private MediaSession session;
    private boolean prepared=false, repeat=false, shuffle=false;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        session=new MediaSession(this,"UniqueMedia");
        session.setCallback(new MediaSession.Callback(){
            @Override public void onPlay(){resumePlayback();}
            @Override public void onPause(){pausePlayback();}
            @Override public void onSkipToNext(){skipNext();}
            @Override public void onSkipToPrevious(){skipPrevious();}
            @Override public void onSeekTo(long position){seekTo((int)position);}
            @Override public void onStop(){stopPlayback();}
        });
        session.setActive(true);
    }

    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null)return START_STICKY;
        try {
            String action=intent.getAction();
            if(ACTION_PLAY.equals(action)){
                JSONArray iu=new JSONArray(intent.getStringExtra(EXTRA_URIS));
                JSONArray in=new JSONArray(intent.getStringExtra(EXTRA_NAMES));
                uris.clear(); names.clear();
                for(int i=0;i<iu.length();i++)uris.add(iu.getString(i));
                for(int i=0;i<in.length();i++)names.add(in.getString(i));
                if(uris.isEmpty()){stopPlayback();return START_NOT_STICKY;}
                index=Math.max(0,Math.min(intent.getIntExtra(EXTRA_INDEX,0),uris.size()-1));
                startForeground(21,notification());
                playCurrent();
            } else if(ACTION_PAUSE.equals(action)) pausePlayback();
            else if(ACTION_RESUME.equals(action)) resumePlayback();
            else if(ACTION_STOP.equals(action)) stopPlayback();
            else if(ACTION_NEXT.equals(action)) skipNext();
            else if(ACTION_PREVIOUS.equals(action)) skipPrevious();
            else if(ACTION_REPEAT.equals(action)){repeat=!repeat;updateNotificationAndSession();}
            else if(ACTION_SHUFFLE.equals(action)){shuffle=!shuffle;updateNotificationAndSession();}
            else if(ACTION_SEEK.equals(action))seekTo(intent.getIntExtra(EXTRA_SEEK_SECONDS,0));
        } catch(Exception ignored) {}
        return START_STICKY;
    }

    private String currentName(){return index>=0&&index<names.size()?names.get(index):"UniqueMedia";}
    private void playCurrent(){
        releasePlayer();
        if(index<0||index>=uris.size()){stopPlayback();return;}
        try {
            player=new MediaPlayer();
            prepared=false;
            player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            player.setDataSource(this,android.net.Uri.parse(uris.get(index)));
            player.setOnPreparedListener(mp->{prepared=true;mp.start();updateNotificationAndSession();});
            player.setOnCompletionListener(mp->{
                if(repeat)playIndex(index);
                else if(shuffle&&uris.size()>1)playIndex(random.nextInt(uris.size()));
                else if(index+1<uris.size())playIndex(index+1);
                else stopPlayback();
            });
            player.setOnErrorListener((mp,what,extra)->{updateNotificationAndSession();return true;});
            player.prepareAsync();
        } catch(Exception ignored){updateNotificationAndSession();}
    }
    private void playIndex(int next){
        if(next<0||next>=uris.size())return;
        index=next;
        startForeground(21,notification());
        playCurrent();
    }
    private void skipNext(){
        if(uris.isEmpty())return;
        if(shuffle&&uris.size()>1){int next=index;while(next==index)next=random.nextInt(uris.size());playIndex(next);}
        else if(index+1<uris.size())playIndex(index+1);
        else if(repeat)playIndex(0);
    }
    private void skipPrevious(){
        if(uris.isEmpty())return;
        if(prepared&&player!=null&&player.getCurrentPosition()>3000){seekTo(0);return;}
        if(shuffle&&uris.size()>1){int next=index;while(next==index)next=random.nextInt(uris.size());playIndex(next);}
        else if(index>0)playIndex(index-1);
        else if(repeat)playIndex(uris.size()-1);
        else seekTo(0);
    }
    private void seekTo(int seconds){
        if(player!=null&&prepared){
            try{int target=Math.max(0,Math.min(player.getDuration(),player.getCurrentPosition()+seconds*1000));player.seekTo(target);}catch(Exception ignored){}
        }
        updateNotificationAndSession();
    }
    private void pausePlayback(){
        if(player!=null&&prepared){try{if(player.isPlaying())player.pause();}catch(Exception ignored){}}
        updateNotificationAndSession();
    }
    private void resumePlayback(){
        if(player!=null&&prepared){try{if(!player.isPlaying())player.start();}catch(Exception ignored){}}
        else if(player==null)playCurrent();
        updateNotificationAndSession();
    }
    private void updateNotificationAndSession(){
        if(session!=null){
            session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE,currentName())
                .putString(MediaMetadata.METADATA_KEY_ARTIST,"UniqueMedia")
                .putString(MediaMetadata.METADATA_KEY_ALBUM,"UniqueMedia")
                .build());
            long actions=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_STOP;
            int state=player!=null&&prepared&&isPlaying()?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED;
            long position=0;
            try{if(player!=null&&prepared)position=player.getCurrentPosition();}catch(Exception ignored){}
            session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(state,position,1f).build());
        }
        NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        if(manager!=null)manager.notify(21,notification());
    }
    private boolean isPlaying(){try{return player!=null&&prepared&&player.isPlaying();}catch(Exception ignored){return false;}}
    private PendingIntent serviceAction(String action,int requestCode){
        Intent intent=new Intent(this,MediaPlaybackService.class);intent.setAction(action);
        return PendingIntent.getService(this,requestCode,intent,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0));
    }
    private Notification notification(){
        Intent open=new Intent(this,MainActivity.class);
        PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0));
        Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this);
        b.setContentTitle("UniqueMedia").setContentText((isPlaying()?"Playing ":"Paused · ")+currentName())
            .setSmallIcon(com.uniqueone.app.R.drawable.up_icon).setContentIntent(pi)
            .setOngoing(true).setCategory(Notification.CATEGORY_TRANSPORT)
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous,"Previous",serviceAction(ACTION_PREVIOUS,1)).build())
            .addAction(new Notification.Action.Builder(isPlaying()?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,isPlaying()?"Pause":"Play",serviceAction(isPlaying()?ACTION_PAUSE:ACTION_RESUME,2)).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next,"Next",serviceAction(ACTION_NEXT,3)).build());
        if(Build.VERSION.SDK_INT>=21)b.setStyle(new Notification.MediaStyle().setMediaSession(session==null?null:session.getSessionToken()).setShowActionsInCompactView(0,1,2));
        return b.build();
    }
    private void releasePlayer(){if(player!=null){try{player.release();}catch(Exception ignored){}player=null;}prepared=false;}
    private void stopPlayback(){
        releasePlayer();
        uris.clear();names.clear();
        if(session!=null)session.setActive(false);
        stopForeground(true);
        stopSelf();
    }
    private void createChannel(){
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel c=new NotificationChannel(CHANNEL,"UniqueMedia playback",NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Background audio and lock-screen controls for UniqueMedia");
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
    }
    @Override public void onDestroy(){releasePlayer();if(session!=null)session.release();super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}