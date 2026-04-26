variable "aws_region" {
  type    = string
  default = "ap-northeast-2"
}

variable "aws_profile" {
  type    = string
  default = "roomeya"
}

variable "project_name" {
  type    = string
  default = "cloud-island"
}

variable "frontend_bucket_name" {
  type = string
}

variable "frontend_artifact_path" {
  type    = string
  default = "../out"
}
