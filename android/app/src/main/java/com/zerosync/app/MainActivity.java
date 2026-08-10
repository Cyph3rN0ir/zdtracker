package com.zerosync.app;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    private boolean attemptedOfflineCacheRetry = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);

        // The app runs on the production origin so its authenticated cookie,
        // IndexedDB query cache and offline queue all share one origin. On a
        // cold offline launch, retry that same URL through WebView's cache and
        // the installed service worker. Do not replace it with a file:// error
        // page, which has a different storage origin and cannot access the
        // user's cached ZeroSync data.
        webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onPageFinished(WebView view, String url) {
                attemptedOfflineCacheRetry = false;
                view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
                super.onPageFinished(view, url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame() && !attemptedOfflineCacheRetry) {
                    attemptedOfflineCacheRetry = true;
                    view.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
                    view.loadUrl(request.getUrl().toString());
                    return;
                }
                super.onReceivedError(view, request, error);
            }
        });
    }
}
