using System.Globalization;
using System.Net;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using SurveyInfoMVC.Models;

namespace SurveyInfoMVC.Services;

public static class SurveyDashboardMapper
{
    private const string ThirdPartyAgency = "Third-party debt collection agency";
    private const string GovernmentDebt = "Government / taxes (for example, federal, state, municipal)";

    private static readonly HashSet<string> StateCodes = new(StringComparer.Ordinal)
    {
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
        "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
        "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
        "WV", "WI", "WY"
    };

    public static DashboardPayload Map(IReadOnlyList<QuestionProSurveyResponse> responses)
    {
        var completedTotal = responses.Count(response =>
            string.Equals(response.ResponseStatus, "Completed", StringComparison.OrdinalIgnoreCase));
        var mapped = new List<DashboardRecord>();
        foreach (var response in responses)
        {
            if (!string.Equals(response.ResponseStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var company = FirstAnswer(response, "best describes your company");
            if (!string.Equals(company, ThirdPartyAgency, StringComparison.Ordinal))
            {
                continue;
            }

            var state = StateCode(FirstAnswer(response, "headquartered"));
            var submittedDate = SubmittedDate(response);
            if (state == null || submittedDate == null)
            {
                continue;
            }

            mapped.Add(new DashboardRecord(
                response.ResponseId.ToString(CultureInfo.InvariantCulture),
                DedupeKey(response),
                response.UtcTimestamp ?? 0,
                submittedDate,
                state,
                FirstAnswer(response, "total collected amount"),
                FirstAnswer(response, "fee structure"),
                FirstAnswer(response, "Assigned Accounts referred"),
                Answers(response, "types of debt")));
        }

        var unique = mapped
            .GroupBy(record => record.DedupeKey, StringComparer.OrdinalIgnoreCase)
            .Select(group => group
                .OrderByDescending(record => record.UtcTimestamp)
                .ThenByDescending(record => record.Id, StringComparer.Ordinal)
                .First())
            .OrderBy(record => record.SubmittedDate)
            .ThenBy(record => record.Id, StringComparer.Ordinal)
            .Select(record => new DashboardResponseRow(
                record.Id,
                record.SubmittedDate,
                record.State,
                "",
                false,
                record.Collected,
                record.Fee,
                record.Referred,
                record.DebtTypes))
            .ToList();

        return new DashboardPayload(false, DateTimeOffset.UtcNow, completedTotal, unique);
    }

    private static string DedupeKey(QuestionProSurveyResponse response)
    {
        var email = response.EmailAddress?.Trim();
        return string.IsNullOrWhiteSpace(email)
            ? "id:" + response.ResponseId.ToString(CultureInfo.InvariantCulture)
            : email;
    }

    private static string? SubmittedDate(QuestionProSurveyResponse response)
    {
        if (!string.IsNullOrWhiteSpace(response.Timestamp))
        {
            var cleaned = string.Join(
                ' ',
                response.Timestamp.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(5));
            if (DateTime.TryParseExact(
                    cleaned,
                    "dd MMM, yyyy hh:mm:ss tt",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var parsed))
            {
                return parsed.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            }
        }

        if (response.UtcTimestamp is not > 0)
        {
            return null;
        }

        var eastern = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
        var local = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeSeconds(response.UtcTimestamp.Value), eastern);
        return local.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static string? FirstAnswer(QuestionProSurveyResponse response, string questionText)
    {
        return Answers(response, questionText).FirstOrDefault();
    }

    private static IReadOnlyList<string> Answers(QuestionProSurveyResponse response, string questionText)
    {
        var match = response.ResponseSet.FirstOrDefault(answer =>
            Plain(answer.QuestionText).Contains(questionText, StringComparison.OrdinalIgnoreCase));
        if (match == null)
        {
            return [];
        }

        var values = new List<string>();
        foreach (var answer in match.AnswerValues)
        {
            var valueText = Plain(answer.Value?.Text);
            var text = valueText.Length > 0 ? valueText : Plain(answer.AnswerText);
            if (text.Length == 0 || text.Equals("N/A", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            values.Add(NormalizeDebtType(text));
        }

        return values;
    }

    private static string NormalizeDebtType(string text)
    {
        if (text.StartsWith("Government / taxes", StringComparison.OrdinalIgnoreCase)
            || text.Equals("federal, state, municipal)", StringComparison.OrdinalIgnoreCase))
        {
            return GovernmentDebt;
        }

        return text;
    }

    private static string? StateCode(string? answer)
    {
        if (string.IsNullOrWhiteSpace(answer))
        {
            return null;
        }

        var match = Regex.Match(answer, @"\(([A-Z]{2})\)\s*$");
        if (!match.Success || !StateCodes.Contains(match.Groups[1].Value))
        {
            return null;
        }

        return match.Groups[1].Value;
    }

    private static string Plain(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        var withoutTags = Regex.Replace(value, "<[^>]+>", " ");
        var decoded = WebUtility.HtmlDecode(withoutTags);
        return Regex.Replace(decoded, @"\s+", " ").Trim();
    }

    private sealed record DashboardRecord(
        string Id,
        string DedupeKey,
        long UtcTimestamp,
        string SubmittedDate,
        string State,
        string? Collected,
        string? Fee,
        string? Referred,
        IReadOnlyList<string> DebtTypes);
}

public sealed record DashboardPayload(
    [property: JsonPropertyName("sample")] bool Sample,
    [property: JsonPropertyName("last_refreshed")] DateTimeOffset LastRefreshed,
    [property: JsonPropertyName("completed_total")] int CompletedTotal,
    [property: JsonPropertyName("responses")] IReadOnlyList<DashboardResponseRow> Responses);

public sealed record DashboardResponseRow(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("submitted_date")] string SubmittedDate,
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("in_tu_2026")] bool InTu2026,
    [property: JsonPropertyName("q1")] string? Q1,
    [property: JsonPropertyName("q2")] string? Q2,
    [property: JsonPropertyName("q3")] string? Q3,
    [property: JsonPropertyName("q4")] IReadOnlyList<string> Q4);
