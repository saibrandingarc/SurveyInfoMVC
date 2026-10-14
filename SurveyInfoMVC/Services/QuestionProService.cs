using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using SurveyInfoMVC.Models;

namespace SurveyInfoMVC.Services;

public sealed class QuestionProService
{
    private readonly HttpClient _httpClient;
    private readonly QuestionProOptions _options;
    private readonly ILogger<QuestionProService> _logger;

    public QuestionProService(
        HttpClient httpClient,
        IOptions<QuestionProOptions> options,
        ILogger<QuestionProService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<QuestionProSurvey>> GetUserSurveysAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.UserId))
        {
            _logger.LogWarning("QuestionPro apiKey or userId is not configured.");
            return [];
        }

        var surveys = new List<QuestionProSurvey>();
        var page = 1;
        const int perPage = 100;

        while (page <= 20)
        {
            var url = $"users/{Uri.EscapeDataString(_options.UserId)}/surveys?page={page}&perPage={perPage}";
            using var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError(
                    "QuestionPro user surveys request failed. Status: {StatusCode}. Body: {Body}",
                    (int)response.StatusCode,
                    body);
                break;
            }

            var payload = await response.Content.ReadFromJsonAsync<QuestionProUserSurveysResponse>(cancellationToken);
            if (payload?.Response is { Count: > 0 })
            {
                surveys.AddRange(payload.Response);
            }

            var totalPages = payload?.Pagination?.TotalPages ?? page;
            if (payload?.Response is not { Count: > 0 } || page >= totalPages)
            {
                break;
            }

            page++;
        }

        _logger.LogInformation(
            "Fetched {Count} QuestionPro surveys for user {UserId}. Configured survey {SurveyId} present: {Present}.",
            surveys.Count,
            _options.UserId,
            _options.SurveyId,
            surveys.Any(survey => survey.SurveyId.ToString() == _options.SurveyId));

        return surveys;
    }

    public async Task<IReadOnlyList<QuestionProSurveyResponse>> GetSurveyResponsesAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.SurveyId))
        {
            _logger.LogWarning("QuestionPro apiKey or surveyId is not configured.");
            return [];
        }

        var responses = new List<QuestionProSurveyResponse>();
        var page = 1;
        const int perPage = 100;

        while (page <= 50)
        {
            var url = $"surveys/{Uri.EscapeDataString(_options.SurveyId)}/responses?page={page}&perPage={perPage}";
            using var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "QuestionPro survey responses request failed. Status: {StatusCode}. Survey: {SurveyId}. Page: {Page}.",
                    (int)response.StatusCode,
                    _options.SurveyId,
                    page);
                throw new InvalidOperationException(
                    $"QuestionPro survey responses request failed with status {(int)response.StatusCode}.");
            }

            var payload = await response.Content.ReadFromJsonAsync<QuestionProResponsesEnvelope>(JsonOptions, cancellationToken);
            if (payload?.Response is { Count: > 0 })
            {
                responses.AddRange(payload.Response);
            }

            var totalPages = payload?.Pagination?.TotalPages ?? page;
            if (payload?.Response is not { Count: > 0 } || page >= totalPages)
            {
                break;
            }

            page++;
        }

        _logger.LogInformation(
            "Fetched {Count} QuestionPro responses for survey {SurveyId}.",
            responses.Count,
            _options.SurveyId);

        return responses;
    }

    private static readonly System.Text.Json.JsonSerializerOptions JsonOptions = new(System.Text.Json.JsonSerializerDefaults.Web)
    {
        NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString
    };
}
