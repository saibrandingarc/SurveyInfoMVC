namespace SurveyInfoMVC.Models;

public sealed class SurveyDashboardViewModel
{
    public string Crumb { get; init; } = "ACA Supplementary Survey · Survey and Dashboard";

    public string Eyebrow { get; init; } = "ACA Supplementary Survey";

    public string Title { get; init; } = "Survey and Dashboard";

    public string Summary { get; init; } =
        "The survey is five screens, and every agency sees the same five. The dashboard is one private page for Scott and Andrew, showing aggregate results only.";

    public IReadOnlyList<DashboardStat> Stats { get; init; } =
    [
        new DashboardStat("Survey screens", "5", "The same five for every agency"),
        new DashboardStat("Final questions", "4", "Closed to further changes"),
        new DashboardStat("Dashboard panels", "8", "Aggregate results only")
    ];
}

public sealed record DashboardStat(string Label, string Value, string Caption);
