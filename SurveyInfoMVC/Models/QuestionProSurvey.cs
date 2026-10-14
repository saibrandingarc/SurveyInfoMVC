using System.Text.Json.Serialization;

namespace SurveyInfoMVC.Models;

public sealed class QuestionProUserSurveysResponse
{
    public List<QuestionProSurvey> Response { get; set; } = new();

    public QuestionProPagination? Pagination { get; set; }
}

public sealed class QuestionProSurvey
{
    [JsonPropertyName("surveyID")]
    public int SurveyId { get; set; }

    public string? Name { get; set; }

    public string? Status { get; set; }

    public string? Url { get; set; }
}

public sealed class QuestionProPagination
{
    [JsonPropertyName("perPage")]
    public int PerPage { get; set; }

    [JsonPropertyName("totalItems")]
    public int TotalItems { get; set; }

    [JsonPropertyName("currentPage")]
    public int CurrentPage { get; set; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; }
}

public sealed class QuestionProResponsesEnvelope
{
    public List<QuestionProSurveyResponse> Response { get; set; } = new();

    public QuestionProPagination? Pagination { get; set; }
}

public sealed class QuestionProSurveyResponse
{
    [JsonPropertyName("responseID")]
    public long ResponseId { get; set; }

    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    [JsonPropertyName("utctimestamp")]
    public long? UtcTimestamp { get; set; }

    [JsonPropertyName("responseStatus")]
    public string? ResponseStatus { get; set; }

    [JsonPropertyName("emailAddress")]
    public string? EmailAddress { get; set; }

    [JsonPropertyName("responseSet")]
    public List<QuestionProResponseAnswer> ResponseSet { get; set; } = new();
}

public sealed class QuestionProResponseAnswer
{
    [JsonPropertyName("questionID")]
    public long? QuestionId { get; set; }

    [JsonPropertyName("questionCode")]
    public string? QuestionCode { get; set; }

    [JsonPropertyName("questionText")]
    public string? QuestionText { get; set; }

    [JsonPropertyName("answerValues")]
    public List<QuestionProAnswerValue> AnswerValues { get; set; } = new();
}

public sealed class QuestionProAnswerValue
{
    [JsonPropertyName("answerID")]
    public long AnswerId { get; set; }

    [JsonPropertyName("answerText")]
    public string? AnswerText { get; set; }

    [JsonPropertyName("value")]
    public QuestionProAnswerValueData? Value { get; set; }
}

public sealed class QuestionProAnswerValueData
{
    [JsonPropertyName("text")]
    public string? Text { get; set; }
}
