package app.devfeed.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DevFeedWidgetProvider extends AppWidgetProvider {
    private static final String API_URL = "https://devfeed-api.kimyejun978.workers.dev/v1/events";
    private static final String ACTION_REFRESH = "app.devfeed.mobile.action.REFRESH_WIDGET";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action) || ACTION_REFRESH.equals(action)) {
            final PendingResult pendingResult = goAsync();
            final Context appContext = context.getApplicationContext();
            EXECUTOR.execute(() -> {
                try {
                    updateAllWidgets(appContext);
                } finally {
                    pendingResult.finish();
                }
            });
            return;
        }
        super.onReceive(context, intent);
    }

    private static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, DevFeedWidgetProvider.class);
        int[] widgetIds = manager.getAppWidgetIds(component);
        if (widgetIds == null || widgetIds.length == 0) return;

        List<EventRow> rows;
        try {
            rows = fetchEvents();
        } catch (Exception error) {
            rows = new ArrayList<>();
        }

        for (int widgetId : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.devfeed_widget);
            bindInteractions(context, views);
            bindRows(views, rows);
            manager.updateAppWidget(widgetId, views);
        }
    }

    private static void bindInteractions(Context context, RemoteViews views) {
        Intent refreshIntent = new Intent(context, DevFeedWidgetProvider.class).setAction(ACTION_REFRESH);
        PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
                context,
                501,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshPendingIntent);

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent launchPendingIntent = PendingIntent.getActivity(
                    context,
                    502,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, launchPendingIntent);
        }
    }

    private static void bindRows(RemoteViews views, List<EventRow> rows) {
        if (rows.isEmpty()) {
            views.setTextViewText(R.id.widget_event_1, "행사 정보를 불러오지 못했어요");
            views.setTextViewText(R.id.widget_meta_1, "↻ 버튼을 눌러 다시 시도해줘");
            views.setTextViewText(R.id.widget_event_2, "");
            views.setTextViewText(R.id.widget_meta_2, "");
            views.setTextViewText(R.id.widget_status, "네트워크 연결 확인 필요");
            return;
        }

        EventRow first = rows.get(0);
        views.setTextViewText(R.id.widget_event_1, first.title);
        views.setTextViewText(R.id.widget_meta_1, first.meta);

        if (rows.size() > 1) {
            EventRow second = rows.get(1);
            views.setTextViewText(R.id.widget_event_2, second.title);
            views.setTextViewText(R.id.widget_meta_2, second.meta);
        } else {
            views.setTextViewText(R.id.widget_event_2, "새 행사 확인 중");
            views.setTextViewText(R.id.widget_meta_2, "DevFeed가 계속 찾아볼게");
        }

        views.setTextViewText(R.id.widget_status, "30분마다 자동 갱신 · 탭해서 앱 열기");
    }

    private static List<EventRow> fetchEvents() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(API_URL).openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(10000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("x-user-id", "local-default");
        connection.connect();

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            connection.disconnect();
            throw new IllegalStateException("HTTP " + status);
        }

        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        } finally {
            connection.disconnect();
        }

        JSONObject root = new JSONObject(body.toString());
        JSONArray items = root.optJSONArray("items");
        List<EventRow> result = new ArrayList<>();
        if (items == null) return result;

        for (int i = 0; i < items.length() && result.size() < 2; i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String id = item.optString("id", "");
            if (id.startsWith("sample-")) continue;

            String title = item.optString("title", "행사").trim();
            if (title.isEmpty()) continue;
            String startDate = item.optString("startDate", "");
            String location = item.optString("location", "");
            boolean online = item.optBoolean("isOnline", false);
            String meta = buildMeta(startDate, online ? "온라인" : location);
            result.add(new EventRow(title, meta));
        }
        return result;
    }

    private static String buildMeta(String dateValue, String place) {
        String date = formatDate(dateValue);
        String cleanPlace = place == null ? "" : place.trim();
        if (!date.isEmpty() && !cleanPlace.isEmpty()) return date + " · " + cleanPlace;
        if (!date.isEmpty()) return date;
        if (!cleanPlace.isEmpty()) return cleanPlace;
        return "세부 일정 확인 필요";
    }

    private static String formatDate(String value) {
        if (value == null) return "";
        String text = value.trim();
        if (text.length() >= 10 && text.charAt(4) == '-' && text.charAt(7) == '-') {
            return text.substring(5, 7) + "/" + text.substring(8, 10);
        }
        return text.length() > 10 ? text.substring(0, 10) : text;
    }

    private static final class EventRow {
        final String title;
        final String meta;

        EventRow(String title, String meta) {
            this.title = title;
            this.meta = meta;
        }
    }
}
