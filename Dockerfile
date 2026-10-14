FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY SurveyInfoMVC/SurveyInfoMVC.csproj SurveyInfoMVC/
RUN dotnet restore SurveyInfoMVC/SurveyInfoMVC.csproj
COPY SurveyInfoMVC/ SurveyInfoMVC/
WORKDIR /src/SurveyInfoMVC
RUN dotnet publish SurveyInfoMVC.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
# Azure App Service probes port 80. The .NET 8 image defaults to 8080 and a
# non-root user, which cannot bind port 80.
USER root
ENV ASPNETCORE_HTTP_PORTS=80
EXPOSE 80
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "SurveyInfoMVC.dll"]
