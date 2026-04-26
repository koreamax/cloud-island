output "role_arn" {
  value       = aws_iam_role.celesta_readonly.arn
  description = "Use this Role ARN in the Connect AWS tab."
}

output "account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "api_base_url" {
  value       = aws_apigatewayv2_stage.default.invoke_url
  description = "Set this value as NEXT_PUBLIC_API_BASE_URL in the frontend deployment."
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.frontend.domain_name
}
