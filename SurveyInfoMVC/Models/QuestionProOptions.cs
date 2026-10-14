namespace SurveyInfoMVC.Models;

public sealed class QuestionProOptions
{
    public const string SectionName = "questionpro";

    public string ApiKey { get; set; } = "";

    public string SurveyId { get; set; } = "";

    public string UserId { get; set; } = "";

    public string BaseUrl { get; set; } = "https://api.questionpro.com/a/api/v2";
}
