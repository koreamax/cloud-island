resource "aws_s3_bucket" "frontend" {
  bucket = var.frontend_bucket_name
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "Access control for Cloud Island frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "frontend-s3"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
}

data "aws_iam_policy_document" "frontend_bucket" {
  statement {
    sid    = "AllowCloudFrontRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket.json
}

locals {
  frontend_files = [
    for path in fileset(var.frontend_artifact_path, "**") : path
    if path != "runtime-config.json"
  ]

  content_types = {
    css  = "text/css; charset=utf-8"
    html = "text/html; charset=utf-8"
    ico  = "image/x-icon"
    jpg  = "image/jpeg"
    jpeg = "image/jpeg"
    js   = "application/javascript; charset=utf-8"
    json = "application/json; charset=utf-8"
    png  = "image/png"
    svg  = "image/svg+xml"
    txt  = "text/plain; charset=utf-8"
    webp = "image/webp"
  }

  frontend_extensions = {
    for path in local.frontend_files : path => try(regex("[^.]+$", path), "")
  }
}

resource "aws_s3_object" "frontend_assets" {
  for_each = { for path in local.frontend_files : path => path }

  bucket       = aws_s3_bucket.frontend.id
  key          = each.value
  source       = "${var.frontend_artifact_path}/${each.value}"
  etag         = filemd5("${var.frontend_artifact_path}/${each.value}")
  content_type = lookup(local.content_types, lower(local.frontend_extensions[each.value]), "application/octet-stream")
}

resource "aws_s3_object" "runtime_config" {
  bucket       = aws_s3_bucket.frontend.id
  key          = "runtime-config.json"
  content      = jsonencode({ apiBaseUrl = aws_apigatewayv2_stage.default.invoke_url })
  content_type = "application/json; charset=utf-8"
}
