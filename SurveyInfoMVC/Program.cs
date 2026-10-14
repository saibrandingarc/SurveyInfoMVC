using SurveyInfoMVC.Models;
using SurveyInfoMVC.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();
builder.Services.Configure<QuestionProOptions>(builder.Configuration.GetSection(QuestionProOptions.SectionName));
builder.Services.AddHttpClient<QuestionProService>((serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<QuestionProOptions>>().Value;
    var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl)
        ? "https://api.questionpro.com/a/api/v2"
        : options.BaseUrl.TrimEnd('/');
    client.BaseAddress = new Uri(baseUrl + "/");
    client.Timeout = TimeSpan.FromSeconds(60);
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
    if (!string.IsNullOrWhiteSpace(options.ApiKey))
    {
        client.DefaultRequestHeaders.Add("api-key", options.ApiKey);
    }
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();

