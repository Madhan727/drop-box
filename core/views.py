from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse, HttpResponse, Http404
from .models import Drop, DropFile
from django.utils import timezone
import os
import zipfile
from django.conf import settings
import io

def index(request):
    return render(request, 'core/index.html')

def upload_drop(request):
    if request.method == 'POST':
        global_context = request.POST.get('global_context')
        files = request.FILES.getlist('files')
        relative_paths = request.POST.getlist('relative_paths')
        item_contexts = request.POST.getlist('item_contexts') # Optional, if we supported per-file context from UI

        if not files:
            return JsonResponse({'error': 'No files uploaded'}, status=400)
        
        # Check limits (Basic check, though settings handles size body limit)
        if len(files) > 5:
             return JsonResponse({'error': 'Maximum 5 files allowed'}, status=400)

        drop = Drop.objects.create(global_context=global_context)
        
        for i, file in enumerate(files):
            path = relative_paths[i] if i < len(relative_paths) else file.name
            context = item_contexts[i] if i < len(item_contexts) else ""
            DropFile.objects.create(
                drop=drop,
                file=file,
                relative_path=path,
                item_context=context
            )
        
        return JsonResponse({'code': drop.code, 'expires_at': drop.expires_at})
    return JsonResponse({'error': 'Invalid method'}, status=405)

def retrieve_drop(request):
    code = request.GET.get('code')
    try:
        drop = Drop.objects.get(code=code)
        if drop.expires_at < timezone.now():
            drop.delete() # Cleanup if accessed after expiry (lazy cleanup)
            return JsonResponse({'error': 'Drop expired or not found'}, status=404)
        
        files_data = []
        for f in drop.files.all():
            files_data.append({
                'id': f.id,
                'name': f.file.name,
                'path': f.relative_path,
                'size': f.file.size,
                'context': f.item_context
            })
            
        return JsonResponse({
            'code': drop.code,
            'global_context': drop.global_context,
            'files': files_data,
            'expires_at': drop.expires_at
        })
    except Drop.DoesNotExist:
        return JsonResponse({'error': 'Drop not found'}, status=404)

def download_file(request, file_id):
    f = get_object_or_404(DropFile, id=file_id)
    if f.drop.expires_at < timezone.now():
        return Http404("Expired")
    
    response = HttpResponse(f.file, content_type='application/octet-stream')
    response['Content-Disposition'] = f'attachment; filename="{os.path.basename(f.relative_path)}"'
    return response

def download_folder(request, drop_code):
    # Downloads everything as a zip
    drop = get_object_or_404(Drop, code=drop_code)
    if drop.expires_at < timezone.now():
         return Http404("Expired")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zip_file:
        for f in drop.files.all():
            file_path = f.file.path
            zip_path = f.relative_path # Use the stored relative path for structure
            zip_file.write(file_path, zip_path)
    
    buffer.seek(0)
    response = HttpResponse(buffer, content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="drop_{drop.code}.zip"'
    return response
