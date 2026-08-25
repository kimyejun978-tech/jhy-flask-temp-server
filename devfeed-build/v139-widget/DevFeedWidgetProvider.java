package app.devfeed.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class DevFeedWidgetProvider extends AppWidgetProvider {
    private static final String RUNTIME_CONFIG_URL = "https://raw.githubusercontent.com/kimyejun978-tech/jhy-flask-temp-server/devfeed-runtime/devfeed-runtime.json";
    private static final String PREFS = "devfeed_widget_cache";
    private static final String CACHE_KEY = "schedule_json";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        super.onUpdate(context, manager, appWidgetIds);
        renderCached(context, manager, appWidgetIds);
        refresh(context.getApplicationContext(), manager, appWidgetIds);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, appWidgetId, newOptions);
        renderOne(context, manager, appWidgetId, readCache(context));
        refresh(context.getApplicationContext(), manager, new int[]{appWidgetId});
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, DevFeedWidgetProvider.class));
        refresh(context.getApplicationContext(), manager, ids);
    }

    private static void renderCached(Context context, AppWidgetManager manager, int[] ids) {
        String cached = readCache(context);
        for (int id : ids) renderOne(context, manager, id, cached);
    }

    private static String readCache(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(CACHE_KEY, null);
    }

    private static void writeCache(Context context, String body) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(CACHE_KEY, body).apply();
    }

    private static void refresh(Context context, AppWidgetManager manager, int[] ids) {
        new Thread(() -> {
            String body = null;
            try {
                String apiUrl = resolveApiUrl();
                if (apiUrl != null) body = httpGet(apiUrl + "/v1/schedule", true);
                if (body != null && !body.isEmpty()) writeCache(context, body);
            } catch (Exception ignored) {
            }
            String payload = body != null ? body : readCache(context);
            for (int id : ids) renderOne(context, manager, id, payload);
        }, "DevFeedWidgetRefresh").start();
    }

    private static String resolveApiUrl() throws Exception {
        String config = httpGet(RUNTIME_CONFIG_URL + "?t=" + System.currentTimeMillis(), false);
        if (config == null) return null;
        String value = new JSONObject(config).optString("apiUrl", "").trim();
        if (!value.startsWith("https://")) return null;
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }

    private static String httpGet(String url, boolean api) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(7000);
        connection.setReadTimeout(9000);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "DevFeed-Android-Widget/1.3.9");
        if (api) connection.setRequestProperty("x-user-id", "local-default");
        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) {
            connection.disconnect();
            return null;
        }
        BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) out.append(line);
        reader.close();
        connection.disconnect();
        return out.toString();
    }

    private static boolean compact(AppWidgetManager manager, int id) {
        Bundle options = manager.getAppWidgetOptions(id);
        int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 220);
        int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 120);
        return width < 210 || height < 118;
    }

    private static void renderOne(Context context, AppWidgetManager manager, int id, String payload) {
        int layout = compact(manager, id) ? R.layout.devfeed_widget_compact : R.layout.devfeed_widget;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        Date now = new Date();
        views.setTextViewText(R.id.widgetDate, new SimpleDateFormat("M월 d일 EEEE", Locale.KOREAN).format(now));

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(context, 1001, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widgetRoot, pending);
        }

        WidgetData data = parseWidgetData(payload, now);
        views.setTextViewText(R.id.widgetCount, data.countText);
        views.setTextViewText(R.id.statusText, data.statusText);
        views.setTextViewText(R.id.eventTitle, data.title);
        views.setTextViewText(R.id.eventMeta, data.meta);
        views.setTextViewText(R.id.deadlineText, data.deadline);
        views.setViewVisibility(R.id.deadlineText, data.deadline.isEmpty() ? View.GONE : View.VISIBLE);
        views.setTextColor(R.id.deadlineText, 0xFFB95E30);
        manager.updateAppWidget(id, views);
    }

    private static WidgetData parseWidgetData(String payload, Date now) {
        if (payload == null || payload.trim().isEmpty()) {
            return new WidgetData("동기화 필요", "SYNC", "DevFeed를 열어 일정을 동기화해요", "탭해서 앱 열기", "");
        }
        try {
            JSONArray items = new JSONObject(payload).optJSONArray("items");
            if (items == null || items.length() == 0) {
                return new WidgetData("예정 0개", "CLEAR", "참가 예정 일정이 없어요", "새 행사를 찾아보세요", "");
            }

            long nowMs = now.getTime();
            long dayStart = startOfDay(nowMs);
            long dayEnd = endOfDay(nowMs);
            int todayCount = 0;
            JSONObject best = null;
            long bestStart = Long.MAX_VALUE;

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                Date start = parseDate(item.optString("startDate", ""));
                if (start == null) continue;
                Date end = parseDate(item.optString("endDate", ""));
                long s = start.getTime();
                long e = end != null ? end.getTime() : s + 60L * 60L * 1000L;
                if (s <= dayEnd && e >= dayStart) todayCount++;
                if (e >= nowMs && s < bestStart) {
                    best = item;
                    bestStart = s;
                }
            }

            if (best == null) {
                return new WidgetData(todayCount > 0 ? "오늘 " + todayCount + "개" : "예정 " + items.length() + "개", "DONE", "예정된 일정이 모두 끝났어요", "DevFeed에서 새 행사를 확인해보세요", "");
            }

            Date start = parseDate(best.optString("startDate", ""));
            String location = best.optBoolean("isOnline", false) ? "온라인" : best.optString("location", "장소 미정");
            String meta = eventMeta(start, location, now);
            String deadline = deadlineLabel(parseDate(best.optString("deadline", "")), now);
            return new WidgetData(todayCount > 0 ? "오늘 " + todayCount + "개" : "예정 " + items.length() + "개", "UP NEXT", best.optString("title", "다음 일정"), meta, deadline);
        } catch (Exception ignored) {
            return new WidgetData("동기화 필요", "SYNC", "일정을 불러오지 못했어요", "탭해서 DevFeed 열기", "");
        }
    }

    private static String eventMeta(Date start, String location, Date now) {
        if (start == null) return location;
        long startDay = startOfDay(start.getTime());
        long today = startOfDay(now.getTime());
        long diff = Math.round((startDay - today) / 86400000.0);
        String when;
        if (diff == 0) when = "오늘 · " + new SimpleDateFormat("HH:mm", Locale.KOREAN).format(start);
        else if (diff == 1) when = "내일 · " + new SimpleDateFormat("HH:mm", Locale.KOREAN).format(start);
        else when = new SimpleDateFormat("M월 d일 · HH:mm", Locale.KOREAN).format(start);
        return when + " · " + location;
    }

    private static String deadlineLabel(Date deadline, Date now) {
        if (deadline == null) return "";
        long diff = Math.round((startOfDay(deadline.getTime()) - startOfDay(now.getTime())) / 86400000.0);
        if (diff < 0) return "마감";
        if (diff == 0) return "D-DAY";
        return "D-" + diff;
    }

    private static long startOfDay(long time) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(time);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static long endOfDay(long time) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(startOfDay(time));
        c.add(Calendar.DAY_OF_MONTH, 1);
        return c.getTimeInMillis() - 1;
    }

    private static Date parseDate(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        String[] patterns = new String[]{
                "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mmXXX",
                "yyyy-MM-dd"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setLenient(false);
                return format.parse(value);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private static final class WidgetData {
        final String countText;
        final String statusText;
        final String title;
        final String meta;
        final String deadline;

        WidgetData(String countText, String statusText, String title, String meta, String deadline) {
            this.countText = countText;
            this.statusText = statusText;
            this.title = title;
            this.meta = meta;
            this.deadline = deadline;
        }
    }
}
