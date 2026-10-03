package com.uniqueone.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.view.Window;
import android.view.WindowManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://unique-one-162s.onrender.com/";
    private static final String APP_HOST = "unique-one-162s.onrender.com";
    private static final String MEDIA_HOST = "https://unique-one-162s.onrender.com/native-media/";
    private static final int FILE_CHOOSER_REQUEST = 4102;
    private static final int MEDIA_PERMISSION_REQUEST = 4103;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private boolean loadedHostedApp = false;
    private final Map<String, Uri> mediaUris = new HashMap<>();
    private final Map<String, File> sharedFiles = new HashMap<>();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);

        webView.addJavascriptInterface(new NativeStorageBridge(), "UniqueNativeStorage");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())) return false;
                if ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                    return true;
                }
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return interceptNativeMedia(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loadedHostedApp = url != null && url.startsWith(APP_URL);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame() && !loadedHostedApp) {
                    view.stopLoading();
                    view.loadUrl("file:///android_asset/index.html");
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        setContentView(webView);
        webView.loadUrl(APP_URL);
    }

    private WebResourceResponse interceptNativeMedia(Uri url) {
        if (url == null || !MEDIA_HOST.equalsIgnoreCase(url.toString().substring(0, Math.min(MEDIA_HOST.length(), url.toString().length())))) return null;
        String full = url.toString();
        if (!full.startsWith(MEDIA_HOST)) return null;
        String id;
        try { id = URLDecoder.decode(full.substring(MEDIA_HOST.length()), "UTF-8"); } catch (Exception e) { return null; }

        try {
            Uri source = mediaUris.get(id);
            if (source != null) {
                InputStream stream = getContentResolver().openInputStream(source);
                if (stream == null) return null;
                return new WebResourceResponse(mimeForUri(source), "UTF-8", stream);
            }
            File file = sharedFiles.get(id);
            if (file != null && file.exists()) {
                return new WebResourceResponse(mimeForName(file.getName()), "UTF-8", new FileInputStream(file));
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String mimeForUri(Uri uri) {
        String mime = getContentResolver().getType(uri);
        return mime != null ? mime : "application/octet-stream";
    }

    private String mimeForName(String name) {
        String ext = MimeTypeMap.getFileExtensionFromUrl(name);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }

    private boolean hasMediaAccess() {
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            return checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED;
        }
        return checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestMediaAccessInternal() {
        ArrayList<String> permissions = new ArrayList<>();
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO);
        } else {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        ArrayList<String> pending = new ArrayList<>();
        for (String p : permissions) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) pending.add(p);
        if (pending.isEmpty()) {
            dispatchAccessResult(true);
        } else {
            requestPermissions(pending.toArray(new String[0]), MEDIA_PERMISSION_REQUEST);
        }
    }

    private void dispatchAccessResult(boolean granted) {
        if (webView != null) {
            webView.post(() -> webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('mediaAccessResult',{detail:{granted:" + granted + "}}));", null));
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MEDIA_PERMISSION_REQUEST) dispatchAccessResult(hasMediaAccess());
    }

    private JSONArray queryCollection(Uri collection, String kind, int offset, int limit) {
        JSONArray result = new JSONArray();
        String[] projection = new String[] {
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.MIME_TYPE,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.DATE_MODIFIED
        };
        String sort = MediaStore.MediaColumns.DATE_MODIFIED + " DESC";
        String selection = null;
        String[] args = null;
        if ("audio".equals(kind) && android.os.Build.VERSION.SDK_INT >= 29) {
            selection = MediaStore.Audio.Media.IS_MUSIC + "=? OR " + MediaStore.Audio.Media.IS_PODCAST + "=?";
            args = new String[] {"1", "1"};
        }
        try (Cursor cursor = getContentResolver().query(collection, projection, selection, args, sort)) {
            if (cursor == null) return result;
            int skipped = 0;
            int count = 0;
            int idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
            int nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME);
            int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE);
            int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE);
            while (cursor.moveToNext()) {
                if (skipped++ < offset) continue;
                if (count++ >= limit) break;
                long id = cursor.getLong(idCol);
                String name = cursor.getString(nameCol);
                String mime = cursor.getString(mimeCol);
                long size = cursor.getLong(sizeCol);
                Uri itemUri = Uri.withAppendedPath(collection, String.valueOf(id));
                String key = kind + ":" + id;
                mediaUris.put(key, itemUri);
                JSONObject item = new JSONObject();
                item.put("id", key);
                item.put("name", name == null ? "Media" : name);
                item.put("mime", mime == null ? "application/octet-stream" : mime);
                item.put("size", size);
                item.put("url", MEDIA_HOST + Uri.encode(key));
                result.put(item);
            }
        } catch (Exception ignored) {}
        return result;
    }

    private JSONArray listMediaPage(int offset, int limit) {
        JSONArray all = new JSONArray();
        int perKind = Math.max(1, limit / 3);
        JSONArray images = queryCollection(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "image", offset, perKind);
        JSONArray videos = queryCollection(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, "video", offset, perKind);
        JSONArray audio = queryCollection(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, "audio", offset, perKind);
        for (int i=0;i<images.length();i++) all.put(images.opt(i));
        for (int i=0;i<videos.length();i++) all.put(videos.opt(i));
        for (int i=0;i<audio.length();i++) all.put(audio.opt(i));
        return all;
    }

    private JSONArray listReceivedMedia() {
        JSONArray result = new JSONArray();
        File root = new File(getFilesDir(), "unique-media-received");
        if (!root.exists()) return result;
        File[] files = root.listFiles();
        if (files == null) return result;
        for (File file : files) {
            if (!file.isFile()) continue;
            String key = "received:" + file.getName();
            sharedFiles.put(key, file);
            try {
                JSONObject item = new JSONObject();
                item.put("id", key);
                item.put("name", file.getName());
                item.put("mime", mimeForName(file.getName()));
                item.put("size", file.length());
                item.put("url", MEDIA_HOST + Uri.encode(key));
                item.put("isNew", !getSharedPreferences("unique_media", MODE_PRIVATE).getBoolean("seen:" + file.getName(), false));
                result.put(item);
            } catch (Exception ignored) {}
        }
        return result;
    }

    private boolean deleteMediaItem(String id) {
        try {
            Uri uri = mediaUris.get(id);
            if (uri != null) {
                int deleted = getContentResolver().delete(uri, null, null);
                if (deleted > 0) {
                    mediaUris.remove(id);
                    return true;
                }
            }
            File file = sharedFiles.get(id);
            if (file != null && file.exists()) {
                boolean deleted = file.delete();
                if (deleted) sharedFiles.remove(id);
                return deleted;
            }
        } catch (SecurityException ignored) {
            // Android may require a user-confirmed recoverable security flow for protected media.
        } catch (Exception ignored) {}
        return false;
    }

    private class NativeStorageBridge {
        @JavascriptInterface public boolean hasMediaAccess() { return MainActivity.this.hasMediaAccess(); }
        @JavascriptInterface public void requestMediaAccess() { MainActivity.this.requestMediaAccessInternal(); }
        @JavascriptInterface public String listMedia() { return listMediaPage(0, 300); }
        @JavascriptInterface public String listMediaPage(int offset, int limit) { return listMediaPage(Math.max(0, offset), Math.min(300, Math.max(1, limit))).toString(); }
        @JavascriptInterface public String getSharedMedia() { return listReceivedMedia().toString(); }
        @JavascriptInterface public void markMediaSeen(String id) {
            if (id != null && id.startsWith("received:")) {
                String name = id.substring("received:".length());
                getSharedPreferences("unique_media", MODE_PRIVATE).edit().putBoolean("seen:" + name, true).apply();
            }
        }
        @JavascriptInterface public boolean deleteMedia(String id) { return MainActivity.this.deleteMediaItem(id); }
        @JavascriptInterface public boolean playBackgroundMedia(String idsJson, int index) {
            try {
                JSONArray ids = new JSONArray(idsJson);
                JSONArray uris = new JSONArray();
                JSONArray names = new JSONArray();
                for (int i = 0; i < ids.length(); i++) {
                    String id = ids.getString(i);
                    Uri uri = mediaUris.get(id);
                    if (uri == null) {
                        File file = sharedFiles.get(id);
                        if (file != null) uri = Uri.fromFile(file);
                    }
                    if (uri != null) { uris.put(uri.toString()); names.put(id); }
                }
                if (uris.length() == 0) return false;
                Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                intent.setAction(MediaPlaybackService.ACTION_PLAY);
                intent.putExtra(MediaPlaybackService.EXTRA_URIS, uris.toString());
                intent.putExtra(MediaPlaybackService.EXTRA_NAMES, names.toString());
                intent.putExtra(MediaPlaybackService.EXTRA_INDEX, Math.max(0, Math.min(index, uris.length() - 1)));
                if (android.os.Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
                return true;
            } catch (Exception e) { return false; }
        }
        @JavascriptInterface public void pauseBackgroundMedia() {
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_PAUSE); startService(intent);
        }
        @JavascriptInterface public void resumeBackgroundMedia() {
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_RESUME); startService(intent);
        }
        @JavascriptInterface public void stopBackgroundMedia() {
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_STOP); startService(intent);
        }
        @JavascriptInterface public void backgroundToggleRepeat() {
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_REPEAT); startService(intent);
        }
        @JavascriptInterface public void backgroundToggleShuffle() {
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_SHUFFLE); startService(intent);
        }
        @JavascriptInterface public void seekBackgroundMedia(int seconds) {
            Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
            intent.setAction(MediaPlaybackService.ACTION_SEEK);
            intent.putExtra(MediaPlaybackService.EXTRA_SEEK_SECONDS, seconds);
            startService(intent);
        }
        @JavascriptInterface public boolean shareNativeMedia(String idsJson) {
            try {
                JSONArray ids = new JSONArray(idsJson);
                ArrayList<Uri> uris = new ArrayList<>();
                for (int i=0;i<ids.length();i++) {
                    String id = ids.getString(i);
                    Uri uri = mediaUris.get(id);
                    if (uri != null) uris.add(uri);
                }
                if (uris.isEmpty()) return false;
                Intent intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
                intent.setType("*/*");
                intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(intent, "Share with"));
                return true;
            } catch (Exception e) { return false; }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null && loadedHostedApp) webView.reload();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
