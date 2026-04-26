resource "aws_dynamodb_table" "island_snapshots" {
  name         = "${var.project_name}-island-snapshots"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "accountId"
  range_key    = "snapshotAt"

  attribute {
    name = "accountId"
    type = "S"
  }

  attribute {
    name = "snapshotAt"
    type = "S"
  }
}

data "archive_file" "lambda_bundle" {
  type        = "zip"
  source_dir  = "../dist"
  output_path = "../dist/lambda-bundle.zip"
}

resource "aws_lambda_function" "sync" {
  function_name    = "${var.project_name}-sync"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "backend/lambdas/sync/index.handler"
  filename         = data.archive_file.lambda_bundle.output_path
  source_code_hash = data.archive_file.lambda_bundle.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      CLOUD_ISLAND_EXTERNAL_ID = "celesta-local-test"
      SNAPSHOT_TABLE_NAME      = aws_dynamodb_table.island_snapshots.name
    }
  }
}

resource "aws_lambda_function" "island" {
  function_name    = "${var.project_name}-island"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "backend/lambdas/island/index.handler"
  filename         = data.archive_file.lambda_bundle.output_path
  source_code_hash = data.archive_file.lambda_bundle.output_base64sha256
  timeout          = 15
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project_name}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "sync" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.sync.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "island" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.island.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "sync" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /sync"
  target    = "integrations/${aws_apigatewayv2_integration.sync.id}"
}

resource "aws_apigatewayv2_route" "island" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /island"
  target    = "integrations/${aws_apigatewayv2_integration.island.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "allow_sync_api" {
  statement_id  = "AllowSyncInvokeFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_island_api" {
  statement_id  = "AllowIslandInvokeFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.island.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
