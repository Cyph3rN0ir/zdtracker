package com.zerosync.app;

import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Intercept WebView errors so we can show a branded offline page
        // instead of the default Chrome "Webpage not available" screen.
        getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // Only intercept main-frame navigations (not sub-resource failures).
                if (request != null && request.isForMainFrame()) {
                    // Load the local offline page from the APK's assets.
                    view.loadUrl("file:///android_asset/offline.html");
                    return;
                }
                super.onReceivedError(view, request, error);
            }
        });
    }
}
