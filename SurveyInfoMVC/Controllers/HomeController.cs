using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SurveyInfoMVC.Models;
using SurveyInfoMVC.Services;

namespace SurveyInfoMVC.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    private readonly QuestionProService _questionPro;

    public HomeController(ILogger<HomeController> logger, QuestionProService questionPro)
    {
        _logger = logger;
        _questionPro = questionPro;
    }

    public IActionResult Index()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public async Task<IActionResult> Responses(CancellationToken cancellationToken)
    {
        try
        {
            var responses = await _questionPro.GetSurveyResponsesAsync(cancellationToken);
            return Json(SurveyDashboardMapper.Map(responses));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unable to load QuestionPro survey responses.");
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}

