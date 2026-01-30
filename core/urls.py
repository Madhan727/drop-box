from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('upload/', views.upload_drop, name='upload_drop'),
    path('retrieve/', views.retrieve_drop, name='retrieve_drop'),
    path('download/<int:file_id>/', views.download_file, name='download_file'),
    path('download-folder/<str:drop_code>/', views.download_folder, name='download_folder'),
]
